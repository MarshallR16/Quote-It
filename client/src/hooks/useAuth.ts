import { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [requiresProfileCompletion, setRequiresProfileCompletion] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('[useAuth] Firebase auth state changed:', user ? `User: ${user.email}` : 'No user');
      setFirebaseUser(user);
      setIsLoadingAuth(false);
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
        setRequiresProfileCompletion(true);
        return false;
      }
      return failureCount < 3;
    },
  });

  // Clear requiresProfileCompletion when user is successfully loaded
  useEffect(() => {
    if (dbUser && requiresProfileCompletion) {
      setRequiresProfileCompletion(false);
    }
  }, [dbUser, requiresProfileCompletion]);

  console.log('[useAuth] State:', {
    firebaseUser: firebaseUser?.email || null,
    dbUser: dbUser?.email || null,
    isLoadingAuth,
    isLoadingDb,
    requiresProfileCompletion,
    error: error?.message || null,
    isAuthenticated: !!firebaseUser && !!dbUser,
  });

  return {
    user: dbUser,
    firebaseUser,
    isLoading: isLoadingAuth || isLoadingDb,
    isAuthenticated: !!firebaseUser && !!dbUser,
    requiresProfileCompletion,
  };
}
