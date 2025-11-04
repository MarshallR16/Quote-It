import { useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch user from database using Firebase UID
  const { data: dbUser, isLoading: isLoadingDb } = useQuery<User>({
    queryKey: ["/api/auth/user", firebaseUser?.uid],
    enabled: !!firebaseUser,
    retry: false,
  });

  return {
    user: dbUser,
    firebaseUser,
    isLoading: isLoadingAuth || isLoadingDb,
    isAuthenticated: !!firebaseUser && !!dbUser,
  };
}
