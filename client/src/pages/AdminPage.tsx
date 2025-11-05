import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Trophy, DollarSign, Package, ShoppingCart, Clock, Shield } from "lucide-react";

interface Analytics {
  total_orders: number;
  total_revenue: string;
  pending_orders: number;
  products_sold_count: number;
  active_products: number;
}

interface Order {
  id: string;
  amount: string;
  status: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  created_at: string;
}

export default function AdminPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: weeklyWinner, isLoading: isLoadingWinner } = useQuery<any>({
    queryKey: ["/api/products/weekly-winner"],
  });

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery<Analytics>({
    queryKey: ["/api/admin/analytics"],
    enabled: !!user?.isAdmin,
  });

  const { data: recentOrders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/admin/recent-orders"],
    enabled: !!user?.isAdmin,
  });

  const makeMeAdminMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/make-me-admin", {});
      return res;
    },
    onSuccess: () => {
      toast({
        title: "Success!",
        description: "You are now an admin. Refresh the page to see admin features.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to become admin",
      });
    },
  });

  const selectWinnerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/select-weekly-winner", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products/weekly-winner"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: data.product ? "Winner selected & product created!" : "Winner selected!",
        description: data.product 
          ? `Printful product created for: "${data.quote.text.substring(0, 50)}..."`
          : `Quote: "${data.quote.text.substring(0, 50)}..."`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to select weekly winner",
        variant: "destructive",
      });
    },
  });

  // Check if user is admin
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 pt-16">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Card className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h1 className="text-2xl font-bold font-display mb-2">Admin Access Required</h1>
            <p className="text-muted-foreground mb-6">
              You need admin privileges to access this page.
            </p>
            <Button
              onClick={() => makeMeAdminMutation.mutate()}
              disabled={makeMeAdminMutation.isPending}
              data-testid="button-make-me-admin"
            >
              {makeMeAdminMutation.isPending ? "Processing..." : "Make Me Admin (First User Only)"}
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              This button only works if there are no existing admins.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">Manage weekly winners, view sales, and track revenue</p>
        </div>

        {/* Analytics Cards */}
        {!isLoadingAnalytics && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-md">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold" data-testid="text-total-revenue">
                    ${parseFloat(analytics.total_revenue).toFixed(2)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-md">
                  <ShoppingCart className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed Orders</p>
                  <p className="text-2xl font-bold" data-testid="text-total-orders">
                    {analytics.total_orders}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-md">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Products Sold</p>
                  <p className="text-2xl font-bold" data-testid="text-products-sold">
                    {analytics.products_sold_count}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-md">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Orders</p>
                  <p className="text-2xl font-bold" data-testid="text-pending-orders">
                    {analytics.pending_orders}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-6 h-6" />
            <h2 className="text-xl font-bold">Automatic Weekly Winner</h2>
          </div>
          <p className="text-muted-foreground mb-4">
            Click to automatically select the quote with the highest votes and create a Printful T-shirt product
          </p>
          <Button
            onClick={() => selectWinnerMutation.mutate()}
            disabled={selectWinnerMutation.isPending}
            data-testid="button-select-winner"
          >
            {selectWinnerMutation.isPending ? "Processing..." : "Select Winner & Create Product"}
          </Button>
        </Card>

        {isLoadingWinner ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading current winner...</p>
          </Card>
        ) : weeklyWinner ? (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Current Weekly Product</h2>
            <div className="mb-4">
              <p className="text-lg font-medium mb-2">"{weeklyWinner.quote?.text}"</p>
              <p className="text-sm text-muted-foreground">- {weeklyWinner.quote?.authorId}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Votes: {weeklyWinner.winner?.finalVoteCount}
              </p>
            </div>
            {weeklyWinner.product ? (
              <div className="bg-muted/30 rounded-md p-4">
                <p className="text-sm font-medium mb-1">
                  ✓ Printful product active
                </p>
                <p className="text-sm text-muted-foreground">
                  Printful ID: {weeklyWinner.product.printfulSyncProductId}
                </p>
                <p className="text-sm text-muted-foreground">
                  Price: ${weeklyWinner.product.price}
                </p>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-md p-4">
                <p className="text-sm text-muted-foreground">
                  Product not yet created
                </p>
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-6">
            <p className="text-muted-foreground">No weekly winner yet. Click the button above to select the top-voted quote and create the product automatically!</p>
          </Card>
        )}

        {/* Recent Orders */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Recent Orders</h2>
          {isLoadingOrders ? (
            <p className="text-muted-foreground">Loading orders...</p>
          ) : recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div 
                  key={order.id} 
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-md"
                  data-testid={`order-${order.id}`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    <p className="text-sm text-muted-foreground mt-1">{order.product_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${parseFloat(order.amount).toFixed(2)}</p>
                    <p className={`text-sm ${order.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {order.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No orders yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
