import admin from "firebase-admin";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import crypto from "crypto";

// Initialize Firebase Admin with minimal config for token verification
// Using credential: none mode which only allows token verification without requiring service account
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      credential: admin.credential.applicationDefault(),
    });
  } catch (error) {
    // If application default credentials fail (e.g., in development), initialize without credentials
    // This still allows ID token verification
    console.log('[Firebase Admin] Using minimal initialization for development');
    admin.initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }
}

export const auth = admin.auth();

// Generate a cryptographically secure 8-character referral code
// Uses base62 (alphanumeric) excluding similar-looking characters (0/O, 1/I/l)
async function generateReferralCode(): Promise<string> {
  const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // 32 chars, no ambiguous ones
  const codeLength = 8;
  
  // Try up to 10 times to generate a unique code
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    const randomBytes = crypto.randomBytes(codeLength);
    
    for (let i = 0; i < codeLength; i++) {
      code += charset[randomBytes[i] % charset.length];
    }
    
    // Check if code is unique
    const existingUser = await storage.getUserByReferralCode(code);
    if (!existingUser) {
      return code;
    }
    
    console.log('[Referral] Code collision detected, regenerating...');
  }
  
  // If we still can't generate a unique code after 10 attempts, throw error
  throw new Error('Failed to generate unique referral code after 10 attempts');
}

// Generate a unique username from first and last name
async function generateUniqueUsername(firstName: string, lastName: string): Promise<string> {
  // Start with firstname.lastname format
  const baseUsername = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, '');
  
  // Check if base username is available
  const existingUser = await storage.getUserByUsername(baseUsername);
  if (!existingUser) {
    return baseUsername;
  }
  
  // If not available, append numbers until we find an available one
  let counter = 1;
  while (true) {
    const username = `${baseUsername}${counter}`;
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return username;
    }
    counter++;
  }
}

// Middleware to verify Firebase ID token
export const verifyFirebaseToken: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    (req as any).firebaseUser = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Setup Firebase auth routes
export async function setupFirebaseAuth(app: Express) {
  // Get current user from Firebase token
  app.get("/api/auth/user", verifyFirebaseToken, async (req: any, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      console.log('[AUTH] Checking user in database:', firebaseUser.uid);
      console.log('[AUTH] Token claims:', { name: firebaseUser.name, email: firebaseUser.email, picture: firebaseUser.picture });
      
      // Get or create user in database
      let user = await storage.getUser(firebaseUser.uid);
      
      if (!user) {
        console.log('[AUTH] User not found in DB, extracting profile from token');
        
        // Extract profile data from the ID token claims
        // Firebase ID tokens include: name, email, picture, and other claims
        const displayName = firebaseUser.name || null;
        const photoURL = firebaseUser.picture || null;
        const email = firebaseUser.email || null;
        
        console.log('[AUTH] Extracted from token:', { displayName, photoURL, email });
        
        // Check if we have required information (first and last name)
        const nameParts = displayName?.split(' ') || [];
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        if (!firstName || !lastName) {
          // User needs to complete their profile
          console.log('[AUTH] User missing required profile information');
          return res.status(400).json({ 
            requiresProfile: true,
            message: "Please complete your profile with first and last name",
            email,
            profileImageUrl: photoURL
          });
        }
        
        // Generate unique username
        const username = await generateUniqueUsername(firstName, lastName);
        console.log('[AUTH] Generated username:', username);
        
        // Generate unique referral code
        const referralCode = await generateReferralCode();
        console.log('[AUTH] Generated referral code:', referralCode);
        
        // Create new user with all required fields
        const newUserData = {
          id: firebaseUser.uid,
          email: email || null,
          username,
          firstName,
          lastName,
          profileImageUrl: photoURL || null,
          referralCode,
        };
        console.log('[AUTH] Creating user with data:', newUserData);
        
        await storage.upsertUser(newUserData);
        
        user = await storage.getUser(firebaseUser.uid);
        console.log('[AUTH] User created successfully:', user);
      } else {
        console.log('[AUTH] User found in DB:', user.email);
        
        // BACKFILL: Check if existing user is missing a referral code
        if (!user.referralCode) {
          console.log('[AUTH] Existing user missing referral code, generating one...');
          const referralCode = await generateReferralCode();
          await storage.updateUser(user.id, { referralCode });
          user = await storage.getUser(firebaseUser.uid);
          console.log('[AUTH] Backfilled referral code:', referralCode);
        }
      }
      
      res.json(user);
    } catch (error: any) {
      console.error('[AUTH] Error getting user:', error);
      res.status(500).json({ message: "Error getting user: " + error.message });
    }
  });
  
  // Apply referral code to existing user
  app.post("/api/auth/apply-referral", verifyFirebaseToken, async (req: any, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      const { referralCode } = req.body;
      
      if (!referralCode) {
        return res.status(400).json({ message: "Referral code is required" });
      }
      
      // Get current user
      const user = await storage.getUser(firebaseUser.uid);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user already has a referrer
      if (user.referredBy) {
        return res.status(400).json({ message: "User already has a referral code applied" });
      }
      
      // Find referrer by code
      const referrer = await storage.getUserByReferralCode(referralCode.trim().toUpperCase());
      if (!referrer) {
        return res.status(404).json({ message: "Invalid referral code" });
      }
      
      // Can't refer yourself
      if (referrer.id === user.id) {
        return res.status(400).json({ message: "Cannot use your own referral code" });
      }
      
      // Update user with referrer
      await storage.updateUser(user.id, { referredBy: referrer.id });
      
      // Increment referrer's count
      await storage.incrementReferralCount(referrer.id);
      
      console.log('[AUTH] Applied referral code:', referralCode, 'from', referrer.username, 'to', user.username);
      
      res.json({ success: true, message: "Referral code applied successfully" });
    } catch (error: any) {
      console.error('[AUTH] Error applying referral code:', error);
      res.status(500).json({ message: "Error applying referral code: " + error.message });
    }
  });

  // Complete user profile (for OAuth users who need to provide name)
  app.post("/api/auth/complete-profile", verifyFirebaseToken, async (req: any, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      const { firstName, lastName, referralCode: inputReferralCode } = req.body;
      
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUser(firebaseUser.uid);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Handle referral code if provided
      let referrerId = null;
      if (inputReferralCode) {
        const referrer = await storage.getUserByReferralCode(inputReferralCode.trim().toUpperCase());
        if (referrer) {
          referrerId = referrer.id;
          // Increment referrer's referral count
          await storage.incrementReferralCount(referrer.id);
          console.log('[AUTH] User referred by:', referrer.username);
        } else {
          console.log('[AUTH] Invalid referral code provided:', inputReferralCode);
        }
      }
      
      // Generate unique username
      const username = await generateUniqueUsername(firstName, lastName);
      
      // Generate unique referral code for new user
      const referralCode = await generateReferralCode();
      
      // Get photo from token if available
      const photoURL = firebaseUser.picture || null;
      
      // Create user with complete profile
      const newUserData = {
        id: firebaseUser.uid,
        email: firebaseUser.email || null,
        username,
        firstName,
        lastName,
        profileImageUrl: photoURL,
        referralCode,
        referredBy: referrerId,
      };
      
      await storage.upsertUser(newUserData);
      const user = await storage.getUser(firebaseUser.uid);
      
      res.json(user);
    } catch (error: any) {
      console.error('[AUTH] Error completing profile:', error);
      res.status(500).json({ message: "Error completing profile: " + error.message });
    }
  });
}

// Export for use in protected routes
export const isAuthenticated = verifyFirebaseToken;
