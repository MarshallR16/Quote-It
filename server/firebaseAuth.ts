import admin from "firebase-admin";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

// Initialize Firebase Admin with project ID only (no service account needed for token verification)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  });
}

export const auth = admin.auth();

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
      
      // Get or create user in database
      let user = await storage.getUser(firebaseUser.uid);
      
      if (!user) {
        console.log('[AUTH] User not found in DB, checking Firebase for profile info');
        
        // Fetch full user data from Firebase Admin to get display name and photo
        let displayName = null;
        let photoURL = null;
        
        try {
          const firebaseUserRecord = await auth.getUser(firebaseUser.uid);
          displayName = firebaseUserRecord.displayName;
          photoURL = firebaseUserRecord.photoURL;
          console.log('[AUTH] Firebase user details:', { displayName, photoURL, email: firebaseUserRecord.email });
        } catch (fetchError) {
          console.error('[AUTH] Could not fetch Firebase user details:', fetchError);
        }
        
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
            email: firebaseUser.email,
            profileImageUrl: photoURL
          });
        }
        
        // Generate unique username
        const username = await generateUniqueUsername(firstName, lastName);
        console.log('[AUTH] Generated username:', username);
        
        // Create new user with all required fields
        const newUserData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || null,
          username,
          firstName,
          lastName,
          profileImageUrl: photoURL || null,
        };
        console.log('[AUTH] Creating user with data:', newUserData);
        
        await storage.upsertUser(newUserData);
        
        user = await storage.getUser(firebaseUser.uid);
        console.log('[AUTH] User created successfully:', user);
      } else {
        console.log('[AUTH] User found in DB:', user.email);
      }
      
      res.json(user);
    } catch (error: any) {
      console.error('[AUTH] Error getting user:', error);
      res.status(500).json({ message: "Error getting user: " + error.message });
    }
  });
  
  // Complete user profile (for OAuth users who need to provide name)
  app.post("/api/auth/complete-profile", verifyFirebaseToken, async (req: any, res) => {
    try {
      const firebaseUser = req.firebaseUser;
      const { firstName, lastName } = req.body;
      
      if (!firstName || !lastName) {
        return res.status(400).json({ message: "First name and last name are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUser(firebaseUser.uid);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Generate unique username
      const username = await generateUniqueUsername(firstName, lastName);
      
      // Fetch photo from Firebase if available
      let photoURL = null;
      try {
        const firebaseUserRecord = await auth.getUser(firebaseUser.uid);
        photoURL = firebaseUserRecord.photoURL;
      } catch (fetchError) {
        console.error('[AUTH] Could not fetch Firebase user photo:', fetchError);
      }
      
      // Create user with complete profile
      const newUserData = {
        id: firebaseUser.uid,
        email: firebaseUser.email || null,
        username,
        firstName,
        lastName,
        profileImageUrl: photoURL || null,
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
