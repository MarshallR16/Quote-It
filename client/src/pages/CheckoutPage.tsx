import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

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

function CheckoutForm({ product, clientSecret }: { product: Product; clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full rounded-full"
        size="lg"
        data-testid="button-complete-payment"
      >
        {isProcessing ? "Processing..." : `Pay $${parseFloat(product.price).toFixed(2)}`}
      </Button>
    </form>
  );
}

export default function CheckoutPage() {
  const { productId } = useParams<{ productId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Fetch product details
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const product = products?.find(p => p.id === productId);

  // Create payment intent mutation
  const createPaymentIntent = useMutation({
    mutationFn: async () => {
      // TODO: Replace with actual user ID from auth context
      const userId = "mock-user-id";
      const res = await apiRequest("POST", "/api/create-payment-intent", { productId, userId });
      return await res.json();
    },
    onSuccess: (data: any) => {
      setClientSecret(data.clientSecret);
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

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Product Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The product you're looking for doesn't exist or is no longer available.
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
            <div className="flex justify-between items-center pt-4">
              <span className="font-semibold">Total</span>
              <span className="text-2xl font-bold" data-testid="text-checkout-total">
                ${parseFloat(product.price).toFixed(2)}
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-semibold mb-6">Payment Details</h2>
            {clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm product={product} clientSecret={clientSecret} />
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
