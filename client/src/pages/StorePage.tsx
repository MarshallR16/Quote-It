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

interface HallOfFameEntry {
  id: string;
  quoteId: string;
  allTimeVoteCount: number;
  quote: Quote;
}

export default function StorePage() {
  const [, navigate] = useLocation();
  
  // Fetch current weekly winner product
  const { data: weeklyWinner, isLoading: isLoadingWeekly } = useQuery<WeeklyWinnerData | null>({
    queryKey: ["/api/products/weekly-winner"],
  });

  // Fetch hall of fame entries
  const { data: hallOfFame, isLoading: isLoadingHall } = useQuery<HallOfFameEntry[]>({
    queryKey: ["/api/hall-of-fame"],
  });

  const handleAddToCart = (productId: string) => {
    navigate(`/checkout/${productId}`);
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      {/* Hero Section */}
      <div className="relative h-96 md:h-[500px] overflow-hidden mb-12">
        <img
          src={heroImage}
          alt="Featured winning quote on t-shirt"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center text-center px-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-display">
              Wear Winning Quotes
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-6 max-w-2xl">
              Every week, the community's favorite quote becomes a premium T-shirt
            </p>
            <Button
              size="lg"
              className="rounded-full bg-white/90 text-black hover:bg-white backdrop-blur-sm h-12"
              data-testid="button-shop-collection"
              onClick={() => {
                const quotedSection = document.getElementById('quoted-section');
                quotedSection?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Shop the Collection
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 space-y-16">
        {/* "Quoted" Section - Current Weekly Winner (For Sale) */}
        <section id="quoted-section">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold font-display mb-2">Quoted</h2>
              <p className="text-muted-foreground">This week's winning design</p>
            </div>
          </div>

          {isLoadingWeekly ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading this week's design...</p>
            </div>
          ) : weeklyWinner ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-md">
              <p className="text-muted-foreground text-lg mb-2">No weekly winner yet</p>
              <p className="text-sm text-muted-foreground">
                Check back soon for this week's winning design!
              </p>
            </div>
          )}
        </section>

        {/* "Hall of Fame" Section - Legendary Quotes (Display Only) */}
        <section>
          <div className="mb-6">
            <h2 className="text-3xl font-bold font-display mb-2">Hall of Fame</h2>
            <p className="text-muted-foreground">Legendary all-time quotes</p>
          </div>

          {isLoadingHall ? (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading hall of fame...</p>
            </div>
          ) : hallOfFame && hallOfFame.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {hallOfFame.map((entry) => (
                <ProductCard
                  key={entry.id}
                  id={entry.id}
                  imageUrl={heroImage}
                  quote={entry.quote.text}
                  author={entry.quote.authorId}
                  price={0}
                  onAddToCart={undefined}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-muted/30 rounded-md">
              <p className="text-muted-foreground text-lg mb-2">Hall of Fame is empty</p>
              <p className="text-sm text-muted-foreground">
                The most legendary quotes will be immortalized here!
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
