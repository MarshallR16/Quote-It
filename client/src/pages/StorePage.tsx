import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import heroImage from "@assets/generated_images/Hero_lifestyle_t-shirt_photo_a1c8cecb.png";

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
  
  // Fetch current weekly winner product
  const { data: weeklyWinner, isLoading: isLoadingWeekly } = useQuery<WeeklyWinnerData | null>({
    queryKey: ["/api/products/weekly-winner"],
  });

  const handleAddToCart = (productId: string) => {
    navigate(`/checkout/${productId}`);
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      {/* Simple Header Banner */}
      <div className="bg-card border-b mb-8">
        <div className="max-w-7xl mx-auto px-4 py-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2 font-display">
            This Week's Design
          </h1>
          <p className="text-muted-foreground">
            Every week, the community's favorite quote becomes a premium Bella+Canvas T-shirt
          </p>
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
                <ProductCard
                  id={weeklyWinner.product.id}
                  imageUrl={weeklyWinner.product.imageUrl || heroImage}
                  quote={weeklyWinner.quote.text}
                  author={weeklyWinner.quote.authorId}
                  price={parseFloat(weeklyWinner.product.price)}
                  weekNumber={getWeekNumber(new Date(weeklyWinner.winner.weekStartDate))}
                  onAddToCart={handleAddToCart}
                />
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
