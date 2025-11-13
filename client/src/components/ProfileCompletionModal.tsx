import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProfileCompletionModalProps {
  open: boolean;
  email?: string | null;
  profileImageUrl?: string | null;
}

export default function ProfileCompletionModal({ 
  open, 
  email,
  profileImageUrl 
}: ProfileCompletionModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast({
        variant: "destructive",
        title: "Missing information",
        description: "Please enter both your first and last name",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiRequest(
        "POST",
        "/api/auth/complete-profile",
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          referralCode: referralCode.trim() || undefined,
        }
      );

      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Profile completed!",
        description: "Welcome to Quote-It",
      });
    } catch (error: any) {
      console.error("Error completing profile:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.message || "Failed to complete profile. Please try again.",
      });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent 
        className="max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
          <DialogDescription>
            We need a bit more information to set up your account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleComplete} className="space-y-4">
          {email && (
            <div className="p-3 bg-muted rounded-md text-sm">
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium">{email}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              disabled={isLoading}
              required
              data-testid="input-first-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              disabled={isLoading}
              required
              data-testid="input-last-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode">Referral Code (Optional)</Label>
            <Input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              disabled={isLoading}
              maxLength={8}
              data-testid="input-referral-code"
            />
            <p className="text-xs text-muted-foreground">
              Have a friend's referral code? Enter it for a discount!
            </p>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={isLoading || !firstName.trim() || !lastName.trim()}
              className="w-full"
              data-testid="button-complete-profile"
            >
              {isLoading ? "Creating Account..." : "Complete Profile"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
