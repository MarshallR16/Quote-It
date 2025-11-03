import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import UserStats from "@/components/UserStats";
import QuoteCard from "@/components/QuoteCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { Package, Loader2 } from "lucide-react";

type QuoteWithAuthor = {
  id: string;
  text: string;
  authorId: string;
  voteCount: number;
  createdAt: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
};

type Order = {
  id: string;
  productId: string;
  amount: string;
  status: string;
  createdAt: string;
  stripePaymentIntentId: string | null;
  printfulOrderId: number | null;
};

export default function ProfilePage() {
  const { user } = useAuth();

  const { data: userQuotes = [], isLoading: quotesLoading } = useQuery<QuoteWithAuthor[]>({
    queryKey: [`/api/quotes/user/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: userOrders = [], isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: [`/api/orders/user/${user?.id}`],
    enabled: !!user?.id,
  });

  if (!user) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 pt-16 flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view your profile</p>
      </div>
    );
  }

  const totalVotes = userQuotes.reduce((sum, q) => sum + q.voteCount, 0);
  const wins = 0; // TODO: Implement weekly winners tracking

  const username = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}`
    : user.firstName || user.email || "Anonymous";

  const joinDate = user.createdAt 
    ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
    : "recently";

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* User Stats - Sticky on desktop */}
          <div className="md:col-span-1">
            <div className="md:sticky md:top-24">
              <UserStats
                username={username}
                joinDate={joinDate}
                postsCount={userQuotes.length}
                totalVotes={totalVotes}
                wins={wins}
              />
            </div>
          </div>

          {/* User's Content */}
          <div className="md:col-span-2 space-y-8">
            {/* User's Quotes */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-display" data-testid="heading-my-quotes">My Quotes</h2>
              {quotesLoading ? (
                <div className="flex justify-center py-8" data-testid="loading-quotes">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : userQuotes.length === 0 ? (
                <Card data-testid="empty-quotes">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    You haven't posted any quotes yet
                  </CardContent>
                </Card>
              ) : (
                userQuotes.map((quote) => {
                  // Construct author name with proper fallback logic
                  const firstName = quote.authorFirstName?.trim();
                  const lastName = quote.authorLastName?.trim();
                  const email = quote.authorEmail?.trim();
                  
                  const authorName = (firstName && lastName)
                    ? `${firstName} ${lastName}`
                    : firstName || lastName || email || 'Anonymous';
                  
                  return (
                    <QuoteCard
                      key={quote.id}
                      id={quote.id}
                      content={quote.text}
                      author={authorName}
                      authorId={quote.authorId}
                      upvotes={Math.max(0, quote.voteCount)}
                      downvotes={0}
                      timeAgo={formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                    />
                  );
                })
              )}
            </div>

            {/* Order History */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-display" data-testid="heading-order-history">Order History</h2>
              {ordersLoading ? (
                <div className="flex justify-center py-8" data-testid="loading-orders">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : userOrders.length === 0 ? (
                <Card data-testid="empty-orders">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No orders yet
                  </CardContent>
                </Card>
              ) : (
                userOrders.map((order) => (
                  <Card key={order.id} data-testid={`order-${order.id}`}>
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          Order #{order.id.substring(0, 8)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${order.amount}</p>
                        <p className={`text-sm ${
                          order.status === 'completed' ? 'text-green-600' : 
                          order.status === 'failed' ? 'text-red-600' : 
                          'text-yellow-600'
                        }`} data-testid={`order-status-${order.id}`}>
                          {order.status}
                        </p>
                      </div>
                    </CardHeader>
                    {order.printfulOrderId && (
                      <CardContent className="pt-2">
                        <p className="text-sm text-muted-foreground">
                          Printful Order: #{order.printfulOrderId}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
