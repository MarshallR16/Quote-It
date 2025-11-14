import { useEffect, useState } from "react";
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

  // Fetch user from database using Firebase UID
  const { data: dbUser, isLoading: isLoadingDb, error } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: !!firebaseUser,
    retry: (failureCount, error: any) => {
      // Don't retry if profile completion is required
      if (error?.response?.data?.requiresProfile) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Handle profile completion requirement
  useEffect(() => {
    const errorWithResponse = error as any;
    if (errorWithResponse?.response?.data?.requiresProfile) {
      console.log('[useAuth] Profile completion required, error data:', errorWithResponse.response.data);
      setRequiresProfileCompletion(true);
      setProfileData({
        email: errorWithResponse.response.data.email,
        profileImageUrl: errorWithResponse.response.data.profileImageUrl
      });
    }
  }, [error]);

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
