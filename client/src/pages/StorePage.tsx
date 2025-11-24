import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Trophy, TrendingUp, Clock } from "lucide-react";
import tshirtMockup from "@assets/generated_images/black_t-shirt_product_mockup.png";
import { useEffect, useState } from "react";

interface Quote {
  id: string;
  text: string;
  authorId: string;
}

interface WeeklyWinnerData {
  product: {
    id: string;
    quoteId: string;
    name: string;
    description: string | null;
    price: string;
    imageUrl: string | null;
    isActive: boolean;
  };
  quote: Quote;
  winner: {
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    finalVoteCount: number;
  };
}

export default function StorePage() {
  const [, navigate] = useLocation();
  const [timeLeft, setTimeLeft] = useState<string>("");
  
  // Fetch most recent weekly winner product
  const { data: weeklyWinner, isLoading: isLoadingWeekly, error } = useQuery<WeeklyWinnerData | null>({
    queryKey: ["/api/weekly-winner/current"],
  });

  // Debug logging
  console.log('Store Page - Loading:', isLoadingWeekly);
  console.log('Store Page - Error:', error);
  console.log('Store Page - Data:', weeklyWinner);

  // Calculate time left in the week
  useEffect(() => {
    if (!weeklyWinner?.winner.weekEndDate) return;

    const updateTimeLeft = () => {
      const now = new Date();
      const end = new Date(weeklyWinner.winner.weekEndDate);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      
      if (days > 0) {
        setTimeLeft(`${days} day${days > 1 ? 's' : ''} left`);
      } else if (hours > 0) {
        setTimeLeft(`${hours} hour${hours > 1 ? 's' : ''} left`);
      } else {
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${minutes} minute${minutes > 1 ? 's' : ''} left`);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [weeklyWinner]);

  const handleAddToCart = (productId: string) => {
    navigate(`/checkout/${productId}`);
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      {/* Enhanced Header Banner */}
      <div className="bg-card border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            {/* Weekly Winner Badge */}
            <div className="flex justify-center">
              <Badge className="text-base px-4 py-2 gap-2" data-testid="badge-weekly-winner">
                <Trophy className="w-4 h-4" />
                SHIRT OF THE WEEK
              </Badge>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold font-display">
              Last Week's Winning Quote
            </h1>
            
            {weeklyWinner && (
              <div className="flex items-center justify-center gap-6 text-sm">
                {/* Vote Count */}
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="font-bold text-lg" data-testid="text-vote-count">
                    {weeklyWinner.winner.finalVoteCount.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">VOTES</span>
                </div>
                
                {/* Time Left */}
                {timeLeft && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-semibold" data-testid="text-time-left">{timeLeft}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Current Weekly Winner (For Sale) */}
        <section>
          {isLoadingWeekly ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading this week's design...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-destructive">Error loading weekly winner</p>
            </div>
          ) : weeklyWinner ? (
            <div className="flex flex-col items-center gap-6" data-testid="container-winner-product">
              {/* T-shirt Image */}
              <div className="w-full max-w-md">
                <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                  <img
                    src={weeklyWinner.product.imageUrl || tshirtMockup}
                    alt={`T-shirt with quote: ${weeklyWinner.quote.text}`}
                    className="w-full h-full object-cover"
                    data-testid="img-product"
                  />
                </div>
              </div>

              {/* Purchase Button */}
              <div className="flex flex-col items-center gap-4 w-full max-w-md">
                <div className="flex items-center justify-between w-full">
                  <span className="text-3xl font-bold" data-testid="text-product-price">
                    ${parseFloat(weeklyWinner.product.price).toFixed(2)}
                  </span>
                  <Button
                    size="lg"
                    className="rounded-full px-8"
                    onClick={() => handleAddToCart(weeklyWinner.product.id)}
                    data-testid="button-add-to-cart"
                  >
                    Buy Now
                  </Button>
                </div>
                
                {/* Quote Display */}
                <div className="text-center space-y-2 pt-4">
                  <blockquote className="text-xl font-medium leading-tight">
                    "{weeklyWinner.quote.text}"
                  </blockquote>
                  <Badge variant="secondary" className="text-xs">
                    Week #{getWeekNumber(new Date(weeklyWinner.winner.weekStartDate))} Winner
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Debug: weeklyWinner is null or undefined</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Helper function to get week number from date
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}
