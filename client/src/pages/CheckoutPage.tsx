import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

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

// Initialize Stripe - will be null if key is not provided
const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  quoteId: string;
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
  includeAuthor: boolean;
}

function CheckoutForm({ 
  product, 
  clientSecret, 
  shippingInfo 
}: { 
  product: Product; 
  clientSecret: string;
  shippingInfo: ShippingInfo;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentReady, setIsPaymentReady] = useState(false);

  // Reset isPaymentReady when elements changes (component remounts)
  // This fixes the race condition where isPaymentReady stays true from previous mount
  useEffect(() => {
    setIsPaymentReady(false);
  }, [elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double-check that elements are actually mounted before proceeding
    if (!stripe || !elements) {
      toast({
        title: "Payment not ready",
        description: "Please wait for the payment form to load",
        variant: "destructive",
      });
      return;
    }

    if (!isPaymentReady) {
      toast({
        title: "Payment not ready",
        description: "Please wait for the payment form to finish loading",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Store shipping info for order creation after payment
      sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));
      
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
      });

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Payment failed",
        description: err.message || "An error occurred during payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isButtonDisabled = !stripe || !elements || !isPaymentReady || isProcessing;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement onReady={() => setIsPaymentReady(true)} />
      <Button
        type="submit"
        disabled={isButtonDisabled}
        className="w-full rounded-full"
        size="lg"
        data-testid="button-complete-payment"
      >
        {!isPaymentReady ? "Loading payment form..." : isProcessing ? "Processing..." : `Pay $${parseFloat(product.price).toFixed(2)}`}
      </Button>
    </form>
  );
}

export default function CheckoutPage() {
  const { productId } = useParams<{ productId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [discountInfo, setDiscountInfo] = useState<any>(null);
  
  // Shipping information state
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: '',
    email: '',
    address1: '',
    address2: '',
    city: '',
    state_code: '',
    country_code: 'US',
    zip: '',
    phone: '',
    size: 'M',
    includeAuthor: true,
  });

  // Fetch product details - use staleTime: 0 to always get fresh data
  const { data: products, isLoading, error: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    staleTime: 0,
    refetchOnMount: true,
  });

  const product = products?.find(p => p.id === productId);

  // Create payment intent mutation
  const createPaymentIntent = useMutation({
    mutationFn: async () => {
      // userId is now from authenticated session on server
      const res = await apiRequest("POST", "/api/create-payment-intent", { productId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      setClientSecret(data.clientSecret);
      setDiscountInfo(data.discountInfo);
      // Store payment intent ID for later use
      sessionStorage.setItem('paymentIntentId', data.paymentIntentId);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to initialize payment",
        variant: "destructive",
      });
    },
  });

  // Create payment intent when product is loaded
  useEffect(() => {
    if (product && !clientSecret) {
      // Store product ID for success page
      sessionStorage.setItem('productId', productId!);
      createPaymentIntent.mutate();
    }
  }, [product, clientSecret]);

  if (!stripePromise) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Payment System Unavailable</h1>
          <p className="text-muted-foreground mb-6">
            The payment system is currently being configured. Please check back soon!
          </p>
          <Button onClick={() => navigate("/store")} className="rounded-full">
            Back to Store
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Products</h1>
          <p className="text-muted-foreground mb-6">
            There was an error loading products. Please try again.
          </p>
          <Button onClick={() => navigate("/store")} className="rounded-full">
            Back to Store
          </Button>
        </Card>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The product you're looking for doesn't exist or is no longer available.
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Product ID: {productId || "Not specified"}
          </p>
          <Button onClick={() => navigate("/store")} className="rounded-full">
            Back to Store
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/store")}
          className="mb-6"
          data-testid="button-back-to-store"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Store
        </Button>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold font-display mb-2">Checkout</h1>
            <p className="text-muted-foreground">Complete your purchase</p>
          </div>

          <Card className="p-6">
            <h2 className="font-semibold mb-4">Order Summary</h2>
            <div className="flex gap-4 pb-4 border-b">
              {product.imageUrl && (
                <div className="w-20 h-20 bg-muted rounded overflow-hidden flex-shrink-0">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-medium" data-testid="text-checkout-product-name">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold" data-testid="text-checkout-price">
                  ${parseFloat(product.price).toFixed(2)}
                </p>
              </div>
            </div>
            {discountInfo && discountInfo.discountPercent > 0 ? (
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${discountInfo.originalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-primary">
                  <span>Referral Discount ({discountInfo.discountPercent}%)</span>
                  <span>-${discountInfo.discountAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">Total</span>
                  <span className="text-2xl font-bold" data-testid="text-checkout-total">
                    ${discountInfo.finalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-4">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold" data-testid="text-checkout-total">
                  ${parseFloat(product.price).toFixed(2)}
                </span>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-6">Shipping Information</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={shippingInfo.name}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, name: e.target.value })}
                    required
                    data-testid="input-name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={shippingInfo.email}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, email: e.target.value })}
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="country">Country</Label>
                <Select
                  value={shippingInfo.country_code}
                  onValueChange={(value) => setShippingInfo({ ...shippingInfo, country_code: value, state_code: '' })}
                >
                  <SelectTrigger id="country" data-testid="select-country">
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

              <div>
                <Label htmlFor="address1">Street Address</Label>
                <Input
                  id="address1"
                  value={shippingInfo.address1}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, address1: e.target.value })}
                  required
                  data-testid="input-address"
                />
              </div>

              <div>
                <Label htmlFor="address2">Apartment, Suite, etc. (optional)</Label>
                <Input
                  id="address2"
                  value={shippingInfo.address2}
                  onChange={(e) => setShippingInfo({ ...shippingInfo, address2: e.target.value })}
                  placeholder="Apt 4B, Suite 200, etc."
                  data-testid="input-address2"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={shippingInfo.city}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, city: e.target.value })}
                    required
                    data-testid="input-city"
                  />
                </div>
                <div>
                  <Label htmlFor="state">{shippingInfo.country_code === 'US' ? 'State' : 'Region/Province'}</Label>
                  {shippingInfo.country_code === 'US' ? (
                    <Select
                      value={shippingInfo.state_code}
                      onValueChange={(value) => setShippingInfo({ ...shippingInfo, state_code: value })}
                    >
                      <SelectTrigger id="state" data-testid="select-state">
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
                      value={shippingInfo.state_code}
                      onChange={(e) => setShippingInfo({ ...shippingInfo, state_code: e.target.value })}
                      placeholder="Province/Region"
                      required
                      data-testid="input-state"
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="zip">{shippingInfo.country_code === 'US' ? 'ZIP Code' : 'Postal Code'}</Label>
                  <Input
                    id="zip"
                    value={shippingInfo.zip}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, zip: e.target.value })}
                    required
                    data-testid="input-zip"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="size">T-Shirt Size</Label>
                  <Select
                    value={shippingInfo.size}
                    onValueChange={(value) => setShippingInfo({ ...shippingInfo, size: value })}
                  >
                    <SelectTrigger id="size" data-testid="select-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S">Small</SelectItem>
                      <SelectItem value="M">Medium</SelectItem>
                      <SelectItem value="L">Large</SelectItem>
                      <SelectItem value="XL">X-Large</SelectItem>
                      <SelectItem value="2XL">2X-Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number (optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={shippingInfo.phone}
                    onChange={(e) => setShippingInfo({ ...shippingInfo, phone: e.target.value })}
                    placeholder="For delivery updates"
                    data-testid="input-phone"
                  />
                </div>
              </div>

              {/* Author Attribution Option */}
              <div className="flex items-start space-x-3 pt-4 border-t">
                <Checkbox
                  id="includeAuthor"
                  checked={shippingInfo.includeAuthor}
                  onCheckedChange={(checked) => setShippingInfo({ ...shippingInfo, includeAuthor: checked === true })}
                  data-testid="checkbox-include-author"
                />
                <div className="space-y-1 leading-none">
                  <Label
                    htmlFor="includeAuthor"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Include author attribution on shirt
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Uncheck this if you prefer the quote without the author's username
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-6">Payment Details</h2>
            {clientSecret ? (
              <Elements 
                key={clientSecret} 
                stripe={stripePromise} 
                options={{ clientSecret }}
              >
                <CheckoutForm product={product} clientSecret={clientSecret} shippingInfo={shippingInfo} />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Initializing payment...</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
