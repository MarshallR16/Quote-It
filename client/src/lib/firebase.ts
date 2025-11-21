import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Apple provider with required scopes
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

export async function uploadProfileImage(userId: string, file: File): Promise<string> {
  try {
    const storageRef = ref(storage, `profile-images/${userId}/${Date.now()}-${file.name}`);
    
    // Upload with timeout
    const uploadPromise = uploadBytes(storageRef, file);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Upload timeout - please check your connection')), 30000)
    );
    
    await Promise.race([uploadPromise, timeoutPromise]);
    
    // Get download URL with timeout
    const urlPromise = getDownloadURL(storageRef);
    const urlTimeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('Failed to get image URL - please try again')), 10000)
    );
    
    return await Promise.race([urlPromise, urlTimeoutPromise]);
  } catch (error: any) {
    console.error('Firebase upload error:', error);
    
    // Handle specific Firebase errors
    if (error.code === 'storage/unauthorized') {
      throw new Error('Upload permission denied - please contact support');
    } else if (error.code === 'storage/canceled') {
      throw new Error('Upload was canceled');
    } else if (error.code === 'storage/unknown') {
      throw new Error('Upload failed - please check your connection and try again');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Storage quota exceeded - please contact support');
    } else if (error.message?.includes('timeout')) {
      throw error;
    } else {
      throw new Error(error.message || 'Upload failed - please try again');
    }
  }
}
