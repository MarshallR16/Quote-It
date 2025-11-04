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
        console.log('[AUTH] User not found in DB, creating new user');
        
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
        
        // Create new user
        const newUserData = {
          id: firebaseUser.uid,
          email: firebaseUser.email || null,
          firstName: displayName?.split(' ')[0] || null,
          lastName: displayName?.split(' ').slice(1).join(' ') || null,
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
}

// Export for use in protected routes
export const isAuthenticated = verifyFirebaseToken;
