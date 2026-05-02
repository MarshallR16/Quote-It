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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Gift, PartyPopper, Shirt, ChevronRight } from "lucide-react";
import confetti from "canvas-confetti";

interface WinnerPrizeData {
  prize: {
    id: string;
    productId: string;
    status: string;
    weeklyWinnerId: string;
    expiresAt: string;
  };
  quote: {
    id: string;
    text: string;
  };
  product: {
    id: string;
    name: string;
    variant: string;
  };
  winner: {
    id: string;
    weekId: string;
    weekStartDate: string;
    weekEndDate: string;
    finalVoteCount: number;
  } | null;
}

interface ShippingInfo {
  name: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  phone: string;
  size: string;
}

interface WinnerCelebrationModalProps {
  open: boolean;
  prizeData: WinnerPrizeData | null;
  onComplete: () => void;
}

const US_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "Washington DC" },
];

const T_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "AT", name: "Austria" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "IE", name: "Ireland" },
  { code: "PT", name: "Portugal" },
  { code: "PL", name: "Poland" },
  { code: "CZ", name: "Czech Republic" },
  { code: "NZ", name: "New Zealand" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "HK", name: "Hong Kong" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
];

export default function WinnerCelebrationModal({
  open,
  prizeData,
  onComplete
}: WinnerCelebrationModalProps) {
  const [step, setStep] = useState<"celebration" | "shipping" | "confirmation">("celebration");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: "",
    email: "",
    address1: "",
    address2: "",
    city: "",
    state_code: "",
    country_code: "US",
    zip: "",
    phone: "",
    size: "M",
  });

  useEffect(() => {
    if (open && step === "celebration") {
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#FFA500', '#FF6347'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#FFA500', '#FF6347'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [open, step]);

  const handleShippingChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo(prev => ({ ...prev, [field]: value }));
  };

  const validateShipping = () => {
    return (
      shippingInfo.name.trim() &&
      shippingInfo.email.trim() &&
      shippingInfo.address1.trim() &&
      shippingInfo.city.trim() &&
      shippingInfo.state_code &&
      shippingInfo.zip.trim() &&
      shippingInfo.size
    );
  };

  const handleSubmitShipping = async () => {
    if (!validateShipping() || !prizeData) return;

    setIsLoading(true);
    try {
      await apiRequest("POST", `/api/prizes/${prizeData.prize.id}/claim`, shippingInfo);

      localStorage.setItem(`winner_notified_${prizeData.prize.id}`, "true");

      queryClient.invalidateQueries({ queryKey: ["/api/prizes/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prizes/mine"] });

      setStep("confirmation");

      toast({
        title: "Prize claimed!",
        description: "Your free shirt is on its way!",
      });
    } catch (error: any) {
      console.error("Error claiming prize:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to claim prize. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onComplete();
  };

  if (!prizeData) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent 
        className="max-w-md"
      >
        {step === "celebration" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <DialogTitle className="text-2xl">Congratulations!</DialogTitle>
              <DialogDescription className="text-base">
                Your quote won this week!
              </DialogDescription>
            </DialogHeader>

            <div className="my-6 p-4 bg-muted rounded-lg">
              <p className="text-lg font-serif italic text-center">
                "{prizeData.quote.text}"
              </p>
              {prizeData.winner && (
                <p className="text-sm text-muted-foreground text-center mt-2">
                  {prizeData.winner.finalVoteCount.toLocaleString()} votes
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
              <Gift className="h-8 w-8 text-yellow-500 flex-shrink-0" />
              <div>
                <p className="font-semibold">You won a FREE T-shirt!</p>
                <p className="text-sm text-muted-foreground">
                  Your quote printed with exclusive gold lettering
                </p>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                onClick={() => setStep("shipping")}
                className="w-full"
                data-testid="button-claim-shirt"
              >
                Claim My Free Shirt
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "shipping" && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Shirt className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle>Where should we send it?</DialogTitle>
              <DialogDescription>
                Enter your shipping details to receive your free winner's shirt
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4 mt-4" onSubmit={(e) => { e.preventDefault(); handleSubmitShipping(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    value={shippingInfo.name}
                    onChange={(e) => handleShippingChange("name", e.target.value)}
                    placeholder="John Doe"
                    disabled={isLoading}
                    required
                    data-testid="input-shipping-name"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={shippingInfo.email}
                    onChange={(e) => handleShippingChange("email", e.target.value)}
                    placeholder="john@example.com"
                    disabled={isLoading}
                    required
                    data-testid="input-shipping-email"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select
                    value={shippingInfo.country_code}
                    onValueChange={(value) => handleShippingChange("country_code", value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger data-testid="select-shipping-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="address1">Street Address *</Label>
                  <Input
                    id="address1"
                    type="text"
                    value={shippingInfo.address1}
                    onChange={(e) => handleShippingChange("address1", e.target.value)}
                    placeholder="123 Main St"
                    disabled={isLoading}
                    required
                    data-testid="input-shipping-address"
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="address2">Apartment, Suite, etc. (optional)</Label>
                  <Input
                    id="address2"
                    type="text"
                    value={shippingInfo.address2}
                    onChange={(e) => handleShippingChange("address2", e.target.value)}
                    placeholder="Apt 4B, Suite 200, etc."
                    disabled={isLoading}
                    data-testid="input-shipping-address2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    type="text"
                    value={shippingInfo.city}
                    onChange={(e) => handleShippingChange("city", e.target.value)}
                    placeholder="New York"
                    disabled={isLoading}
                    required
                    data-testid="input-shipping-city"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">{shippingInfo.country_code === "US" ? "State" : "Region/Province"} *</Label>
                  {shippingInfo.country_code === "US" ? (
                    <Select
                      value={shippingInfo.state_code}
                      onValueChange={(value) => handleShippingChange("state_code", value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger data-testid="select-shipping-state">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state.code} value={state.code}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="state"
                      type="text"
                      value={shippingInfo.state_code}
                      onChange={(e) => handleShippingChange("state_code", e.target.value)}
                      placeholder="Province/Region"
                      disabled={isLoading}
                      required
                      data-testid="input-shipping-state"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip">{shippingInfo.country_code === "US" ? "ZIP Code" : "Postal Code"} *</Label>
                  <Input
                    id="zip"
                    type="text"
                    value={shippingInfo.zip}
                    onChange={(e) => handleShippingChange("zip", e.target.value)}
                    placeholder="10001"
                    disabled={isLoading}
                    required
                    data-testid="input-shipping-zip"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size">T-Shirt Size *</Label>
                  <Select
                    value={shippingInfo.size}
                    onValueChange={(value) => handleShippingChange("size", value)}
                    disabled={isLoading}
                  >
                    <SelectTrigger data-testid="select-shipping-size">
                      <SelectValue placeholder="Size" />
                    </SelectTrigger>
                    <SelectContent>
                      {T_SHIRT_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="phone">Phone Number (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={shippingInfo.phone}
                    onChange={(e) => handleShippingChange("phone", e.target.value)}
                    placeholder="For delivery updates"
                    disabled={isLoading}
                    data-testid="input-shipping-phone"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button
                  type="submit"
                  disabled={isLoading || !validateShipping()}
                  className="w-full"
                  data-testid="button-submit-shipping"
                >
                  {isLoading ? "Saving..." : "Send My Free Shirt"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {step === "confirmation" && (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <PartyPopper className="h-8 w-8 text-green-500" />
              </div>
              <DialogTitle className="text-2xl">You're All Set!</DialogTitle>
              <DialogDescription className="text-base">
                Your exclusive gold-lettered winner's shirt is on its way!
              </DialogDescription>
            </DialogHeader>

            <div className="my-6 p-4 bg-muted rounded-lg text-center">
              <Shirt className="h-12 w-12 mx-auto mb-2 text-yellow-500" />
              <p className="text-sm text-muted-foreground">
                You'll receive a shipping confirmation email once your shirt is dispatched.
              </p>
            </div>

            <DialogFooter>
              <Button
                onClick={onComplete}
                className="w-full"
                data-testid="button-close-winner-modal"
              >
                Awesome!
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
