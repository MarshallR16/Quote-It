import ProductCard from "@/components/ProductCard";
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
  const { data: weeklyWinner, isLoading: isLoadingWeekly } = useQuery<WeeklyWinnerData | null>({
    queryKey: ["/api/weekly-winner/current"],
  });

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
            
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every week, the community's favorite quote becomes an exclusive premium Bella+Canvas T-shirt
            </p>
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
          ) : weeklyWinner ? (
            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                {/* Winner Highlight Border */}
                <div className="p-1 bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 rounded-lg" data-testid="container-winner-product">
                  <div className="bg-background rounded-lg">
                    <ProductCard
                      id={weeklyWinner.product.id}
                      imageUrl={weeklyWinner.product.imageUrl || tshirtMockup}
                      quote={weeklyWinner.quote.text}
                      author={weeklyWinner.quote.authorId}
                      price={parseFloat(weeklyWinner.product.price)}
                      weekNumber={getWeekNumber(new Date(weeklyWinner.winner.weekStartDate))}
                      onAddToCart={handleAddToCart}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-md">
              <p className="text-muted-foreground text-lg mb-2">No weekly winner yet</p>
              <p className="text-sm text-muted-foreground">
                Check back soon for this week's winning design!
              </p>
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
