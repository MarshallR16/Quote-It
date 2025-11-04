import { useState } from "react";
import { signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Handle redirect result when user returns from Google sign-in
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          toast({
            title: "Welcome!",
            description: "You've successfully signed in",
          });
          setLocation("/");
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
  }, [setLocation, toast]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      // Try popup first, fall back to redirect if popup is blocked
      try {
        const result = await signInWithPopup(auth, googleProvider);
        if (result.user) {
          toast({
            title: "Welcome!",
            description: "You've successfully signed in",
          });
          setLocation("/");
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
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isLoading ? "Signing in..." : "Continue with Google"}
          </Button>
          
          <p className="text-center text-sm text-muted-foreground">
            Sign in to post quotes, vote, and purchase merchandise
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
