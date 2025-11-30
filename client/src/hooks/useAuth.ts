import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [requiresProfileCompletion, setRequiresProfileCompletion] = useState(false);
  const [profileData, setProfileData] = useState<{ email?: string; profileImageUrl?: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[useAuth] Firebase auth state changed:', user ? `User: ${user.email}` : 'No user');
      setFirebaseUser(user);
      setIsLoadingAuth(false);
      
      // Clear profile data when user signs out
      if (!user) {
        setRequiresProfileCompletion(false);
        setProfileData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Helper to check if error indicates profile completion needed
  const checkProfileRequired = useCallback((err: any): boolean => {
    // Check various possible error structures
    if (err?.response?.data?.requiresProfile) return true;
    // Also check if the error message contains the marker
    if (err?.message?.includes('requiresProfile')) return true;
    return false;
  }, []);

  // Fetch user from database using Firebase UID
  const { data: dbUser, isLoading: isLoadingDb, error, isError } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: !!firebaseUser,
    retry: (failureCount, error: any) => {
      // Don't retry if profile completion is required
      if (checkProfileRequired(error)) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Handle profile completion requirement - check both on error change and when isError becomes true
  useEffect(() => {
    if (!isError || !error) {
      return;
    }
    
    const errorWithResponse = error as any;
    console.log('[useAuth] Query error detected:', { 
      message: errorWithResponse?.message,
      status: errorWithResponse?.response?.status,
      data: errorWithResponse?.response?.data 
    });
    
    if (errorWithResponse?.response?.data?.requiresProfile) {
      console.log('[useAuth] Profile completion required, error data:', errorWithResponse.response.data);
      setRequiresProfileCompletion(true);
      setProfileData({
        email: errorWithResponse.response.data.email,
        profileImageUrl: errorWithResponse.response.data.profileImageUrl
      });
    }
  }, [error, isError]);

  // Clear requiresProfileCompletion when user is successfully loaded
  useEffect(() => {
    if (dbUser && requiresProfileCompletion) {
      console.log('[useAuth] User loaded, clearing profile completion requirement');
      setRequiresProfileCompletion(false);
      setProfileData(null);
    }
  }, [dbUser, requiresProfileCompletion]);

  console.log('[useAuth] State:', {
    firebaseUser: firebaseUser?.email || null,
    dbUser: dbUser?.email || null,
    isLoadingAuth,
    isLoadingDb,
    requiresProfileCompletion,
    profileData,
    error: error?.message || null,
    isAuthenticated: !!firebaseUser && !!dbUser,
  });

  return {
    user: dbUser,
    firebaseUser,
    isLoading: isLoadingAuth || isLoadingDb,
    isAuthenticated: !!firebaseUser && !!dbUser,
    requiresProfileCompletion,
    profileData,
  };
}
