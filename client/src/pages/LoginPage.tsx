import { useState, useEffect } from "react";
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider, appleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle, SiApple } from "react-icons/si";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // Redirect authenticated users to feed
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    // Handle redirect result when user returns from OAuth provider
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          toast({
            title: "Welcome!",
            description: "You've successfully signed in",
          });
          // Don't redirect here - let the isAuthenticated check handle it
        }
      })
      .catch((error) => {
        console.error("Redirect error:", error);
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
      });
  }, [toast]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      // Try popup first, fall back to redirect if popup is blocked
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          // Don't redirect immediately - let useAuth handle it after DB user is created
          toast({
            title: "Welcome!",
            description: "You've successfully signed in",
          });
        }
      } catch (popupError: any) {
        // If popup was blocked, use redirect
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, googleProvider);
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error("Error signing in:", error);
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setIsLoading(true);
    try {
      // Try popup first, fall back to redirect if popup is blocked
      try {
        const result = await signInWithPopup(auth, appleProvider);
        if (result.user) {
          // Don't redirect immediately - let useAuth handle it after DB user is created
          toast({
            title: "Welcome!",
            description: "You've successfully signed in",
          });
        }
      } catch (popupError: any) {
        // If popup was blocked, use redirect
        if (popupError.code === 'auth/popup-blocked' || popupError.code === 'auth/popup-closed-by-user') {
          await signInWithRedirect(auth, appleProvider);
        } else {
          throw popupError;
        }
      }
    } catch (error: any) {
      console.error("Error signing in:", error);
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: error.message,
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-6xl font-bold font-display tracking-tight">"IT"</CardTitle>
          <CardDescription className="text-lg">
            Share quotes, vote on favorites, and shop the best
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full gap-2"
            size="lg"
            data-testid="button-google-signin"
          >
            <SiGoogle className="w-5 h-5" />
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>

          <Button
            onClick={handleAppleSignIn}
            disabled={isLoading}
            className="w-full gap-2"
            size="lg"
            variant="outline"
            data-testid="button-apple-signin"
          >
            <SiApple className="w-5 h-5" />
            {isLoading ? "Signing in..." : "Continue with Apple"}
          </Button>
          
          <p className="text-center text-sm text-muted-foreground">
            Sign in to post quotes, vote, and purchase merchandise
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
