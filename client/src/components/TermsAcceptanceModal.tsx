import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TermsAcceptanceModalProps {
  open: boolean;
  onClose?: () => void;
}

export default function TermsAcceptanceModal({ open, onClose }: TermsAcceptanceModalProps) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setTermsAccepted(false);
    }
  }, [open]);

  const handleAccept = async () => {
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
      await apiRequest({
        url: "/api/users/accept-terms",
        method: "POST",
        data: {
          accepted: true,
          timestamp: Date.now(),
        },
      });

      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Terms accepted",
        description: "You can now use Quote-It",
      });
    } catch (error: any) {
      console.error("Error accepting terms:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to accept terms. Please try again.",
      });
    } finally {
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
          <DialogTitle>Welcome to Quote-It!</DialogTitle>
          <DialogDescription>
            Before you continue, please accept our Terms of Service
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 bg-muted rounded-md space-y-3">
            <h4 className="font-semibold text-sm">Key points:</h4>
            <ul className="list-disc pl-5 space-y-2 text-sm">
              <li>Your quotes can be printed on merchandise and sold in our store</li>
              <li>If your quote wins "Shirt of the Week," it will be available for purchase</li>
              <li>No financial compensation is provided for featured quotes</li>
              <li>You retain ownership but grant us rights to use your content</li>
            </ul>
          </div>

          <div className="flex items-start space-x-3">
            <Checkbox
              id="terms-modal"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              disabled={isLoading}
              data-testid="checkbox-terms-modal"
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="terms-modal"
                className="text-sm font-normal cursor-pointer"
              >
                I agree that my quotes can be used on merchandise as described in the{" "}
                <Link href="/terms">
                  <span className="text-primary hover:underline">Terms of Service</span>
                </Link>
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleAccept}
            disabled={!termsAccepted || isLoading}
            className="w-full"
            data-testid="button-accept-terms"
          >
            {isLoading ? "Accepting..." : "Accept & Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
