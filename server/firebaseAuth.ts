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
      
      // Get or create user in database
      let user = await storage.getUser(firebaseUser.uid);
      
      if (!user) {
        // Create new user
        await storage.upsertUser({
          id: firebaseUser.uid,
          email: firebaseUser.email,
          firstName: firebaseUser.name?.split(' ')[0] || null,
          lastName: firebaseUser.name?.split(' ').slice(1).join(' ') || null,
          profileImageUrl: firebaseUser.picture || null,
        });
        
        user = await storage.getUser(firebaseUser.uid);
      }
      
      res.json(user);
    } catch (error: any) {
      console.error('Error getting user:', error);
      res.status(500).json({ message: "Error getting user: " + error.message });
    }
  });
}

// Export for use in protected routes
export const isAuthenticated = verifyFirebaseToken;
