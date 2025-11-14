import { useEffect, useRef } from "react";
import { getRedirectResult, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function AuthRedirectHandler() {
  const { toast } = useToast();
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only run once per app load
    if (hasChecked.current) return;
    hasChecked.current = true;

    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        
        if (result?.user) {
          console.log("[AUTH REDIRECT] User returned from OAuth:", result.user.email);
          console.log("[AUTH REDIRECT] Provider:", result.providerId);
          
          // Wait for Firebase to fully initialize auth.currentUser
          // This ensures getAuthHeaders() can retrieve the ID token
          const waitForAuth = new Promise<void>((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
              if (user) {
                console.log("[AUTH REDIRECT] Firebase auth ready, currentUser:", user.email);
                unsubscribe();
                resolve();
              }
            });
            
            // Fallback timeout
            setTimeout(() => {
              console.log("[AUTH REDIRECT] Auth timeout, proceeding anyway");
              unsubscribe();
              resolve();
            }, 3000);
          });
          
          await waitForAuth;
          
          // Now trigger useAuth to fetch user with proper Authorization header
          // The GET /api/auth/user endpoint will handle session creation
          await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
          
          console.log("[AUTH REDIRECT] Triggered auth refresh");
        }
      } catch (error: any) {
        console.error("[AUTH REDIRECT] Error:", error);
        
        // Only show error toast for actual errors (not "no redirect result")
        if (error.code && error.code !== 'auth/invalid-credential' && 
            error.code !== 'auth/popup-closed-by-user') {
          toast({
            variant: "destructive",
            title: "Sign in failed",
            description: error.message,
          });
        }
      }
    };

    handleRedirect();
  }, [toast]);

  return null;
}
