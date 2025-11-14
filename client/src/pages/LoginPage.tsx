import { useState, useEffect } from "react";
import { signInWithRedirect, getRedirectResult, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider, appleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle, SiApple } from "react-icons/si";
import { Mail } from "lucide-react";
import { Link } from "wouter";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { toast } = useToast();

  // Handle redirect result when user returns from OAuth provider
  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setIsLoading(true);
          // Get fresh ID token
          const idToken = await result.user.getIdToken(true);
          
          // Send token to backend to create session
          const response = await fetch('/api/auth/firebase', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to authenticate with server');
          }

          toast({
            title: "Welcome!",
            description: "You've successfully signed in",
          });
          
          // Force reload to trigger useAuth to fetch user
          window.location.href = '/';
        }
      } catch (error: any) {
        console.error("Redirect error:", error);
        toast({
          variant: "destructive",
          title: "Sign in failed",
          description: error.message,
        });
        setIsLoading(false);
      }
    };

    handleRedirect();
  }, [toast]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      // Use redirect flow to avoid COOP errors
      await signInWithRedirect(auth, googleProvider);
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
      // Use redirect flow to avoid COOP errors
      await signInWithRedirect(auth, appleProvider);
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please enter your email and password",
      });
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in",
      });
    } catch (error: any) {
      console.error("Error signing in:", error);
      let errorMessage = error.message;
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password. If you don't have an account, please sign up first.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      toast({
        variant: "destructive",
        title: "Sign in failed",
        description: errorMessage,
      });
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please fill in all fields",
      });
      return;
    }

    // Validate name has both first and last name
    const nameParts = name.trim().split(/\s+/);
    if (nameParts.length < 2) {
      toast({
        variant: "destructive",
        title: "Invalid name",
        description: "Please enter both your first and last name",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: "destructive",
        title: "Weak password",
        description: "Password must be at least 6 characters",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        variant: "destructive",
        title: "Terms required",
        description: "Please accept the Terms of Service to continue",
      });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile with display name, referral code, and reload to get fresh token
      if (userCredential.user) {
        const { updateProfile } = await import("firebase/auth");
        // Store referral code in customData temporarily (we'll process it in backend)
        await updateProfile(userCredential.user, { 
          displayName: name.trim(),
        });
        // Reload user to ensure token has updated claims
        await userCredential.user.reload();
        
        // Send referral code to backend if provided
        if (referralCode.trim()) {
          try {
            const idToken = await userCredential.user.getIdToken();
            const response = await fetch('/api/auth/apply-referral', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
              body: JSON.stringify({ referralCode: referralCode.trim() }),
            });
            
            if (!response.ok) {
              console.log('Referral code application failed:', await response.text());
            }
          } catch (error) {
            console.error('Error applying referral code:', error);
            // Don't block signup if referral fails
          }
        }
      }

      toast({
        title: "Account created!",
        description: "Welcome to Quote-It",
      });
    } catch (error: any) {
      console.error("Error signing up:", error);
      let errorMessage = error.message;
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password is too weak";
      }
      toast({
        variant: "destructive",
        title: "Sign up failed",
        description: errorMessage,
      });
      setIsLoading(false);
    } finally {
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
        <CardContent className="space-y-6">
          {/* OAuth Sign In Options */}
          <div className="space-y-3">
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full gap-2"
              size="lg"
              data-testid="button-google-signin"
            >
              <SiGoogle className="w-5 h-5" />
              Continue with Google
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
              Continue with Apple
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Email/Password Authentication */}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-signin-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-signin-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading}
                  data-testid="button-email-signin"
                >
                  <Mail className="w-4 h-4" />
                  {isLoading ? "Signing in..." : "Sign In with Email"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">First and Last Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-signup-name"
                  />
                  <p className="text-xs text-muted-foreground">Your real name is required</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-signup-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    data-testid="input-signup-password"
                  />
                  <p className="text-xs text-muted-foreground">At least 6 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-referral">Referral Code (Optional)</Label>
                  <Input
                    id="signup-referral"
                    type="text"
                    placeholder="Enter code for 10% off"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    disabled={isLoading}
                    data-testid="input-signup-referral"
                  />
                  <p className="text-xs text-muted-foreground">Get 10% off your first purchase</p>
                </div>
                
                {/* Terms & Conditions Checkbox */}
                <div className="flex items-start space-x-3 pt-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    disabled={isLoading}
                    data-testid="checkbox-terms"
                  />
                  <div className="space-y-1 leading-none">
                    <Label
                      htmlFor="terms"
                      className="text-sm font-normal cursor-pointer"
                    >
                      I agree that my quotes can be used on merchandise as described in the{" "}
                      <Link href="/terms">
                        <span className="text-primary hover:underline">Terms of Service</span>
                      </Link>
                    </Label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={isLoading}
                  data-testid="button-email-signup"
                >
                  <Mail className="w-4 h-4" />
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          
          <p className="text-center text-xs text-muted-foreground">
            Sign in to post quotes, vote, and purchase merchandise
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
