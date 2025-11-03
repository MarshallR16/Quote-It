import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function CheckoutSuccessPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [orderDetails, setOrderDetails] = useState<any>(null);

  // Verify payment mutation
  const verifyPayment = useMutation({
    mutationFn: async (data: { paymentIntentId: string; userId: string }) => {
      const res = await apiRequest("POST", "/api/verify-payment", data);
      return await res.json();
    },
    onSuccess: (data) => {
      setOrderDetails(data.order);
      setStatus("success");
      // Clean up session storage
      sessionStorage.removeItem('paymentIntentId');
      sessionStorage.removeItem('productId');
    },
    onError: () => {
      setStatus("error");
    }
  });

  useEffect(() => {
    const handlePaymentVerification = async () => {
      try {
        // Get payment intent ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const paymentIntentId = urlParams.get('payment_intent');
        
        if (!paymentIntentId) {
          setStatus("error");
          return;
        }

        // For now, use a mock user ID since we don't have authentication yet
        // TODO: Replace with actual user ID from auth context
        const userId = "mock-user-id";

        // Verify payment on server side
        verifyPayment.mutate({ paymentIntentId, userId });

      } catch (error) {
        console.error("Error verifying payment:", error);
        setStatus("error");
      }
    };

    handlePaymentVerification();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Confirming your order...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-4">Payment Verification Failed</h1>
          <p className="text-muted-foreground mb-6">
            We couldn't verify your payment. Please contact support if you were charged.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate("/store")}
              className="rounded-full"
            >
              Back to Store
            </Button>
            <Button
              onClick={() => navigate("/profile")}
              className="rounded-full"
            >
              View Orders
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" data-testid="icon-success" />
        <h1 className="text-2xl font-bold mb-4" data-testid="text-success-title">
          Order Confirmed!
        </h1>
        <p className="text-muted-foreground mb-6">
          Thank you for your purchase. Your order has been confirmed and you'll receive a confirmation email shortly.
        </p>
        {orderDetails && (
          <div className="bg-muted/50 rounded p-4 mb-6 text-left">
            <h3 className="font-semibold mb-2">Order Details</h3>
            <div className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Order ID: <span className="font-mono" data-testid="text-order-id">{orderDetails.id}</span>
              </p>
              <p className="text-muted-foreground">
                Total: <span className="font-semibold" data-testid="text-order-total">${parseFloat(orderDetails.amount).toFixed(2)}</span>
              </p>
            </div>
          </div>
        )}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate("/store")}
            className="rounded-full"
            data-testid="button-back-to-store"
          >
            Continue Shopping
          </Button>
          <Button
            onClick={() => navigate("/profile")}
            className="rounded-full"
            data-testid="button-view-orders"
          >
            View Orders
          </Button>
        </div>
      </Card>
    </div>
  );
}
