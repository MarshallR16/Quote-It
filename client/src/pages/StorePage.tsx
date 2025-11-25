import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Trophy, TrendingUp, Clock } from "lucide-react";
import tshirtMockup from "@assets/generated_images/blank_black_t-shirt_mockup.png";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

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
  authorFirstName?: string;
  authorLastName?: string;
  authorUsername?: string;
}

export default function StorePage() {
  const [, navigate] = useLocation();
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  
  // Generate QR code for quote-it.co
  useEffect(() => {
    QRCode.toDataURL('https://quote-it.co', {
      width: 64,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(url => {
      setQrCodeUrl(url);
    }).catch(err => {
      console.error('Failed to generate QR code:', err);
    });
  }, []);
  
  // Fetch most recent weekly winner product with cache-busting
  const { data: rawData, isLoading: isLoadingWeekly, error } = useQuery({
    queryKey: ["/api/weekly-winner/current"],
    queryFn: async () => {
      // Add timestamp to force fresh request and bypass any caching
      const timestamp = Date.now();
      const url = `/api/weekly-winner/current?_t=${timestamp}`;
      console.log('[StorePage] Fetching from:', url);
      
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      
      console.log('[StorePage] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const text = await response.text();
      console.log('[StorePage] Raw response text:', text.substring(0, 200));
      
      const data = text ? JSON.parse(text) : null;
      console.log('[StorePage] Parsed data:', data);
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const weeklyWinner = (rawData && typeof rawData === 'object' && 'product' in rawData) ? rawData as WeeklyWinnerData : null;

  console.log('[StorePage] Query state:', { 
    isLoading: isLoadingWeekly, 
    hasError: !!error, 
    hasData: !!weeklyWinner,
    rawData,
    error 
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        {/* Current Weekly Winner (For Sale) */}
        <section>
          {isLoadingWeekly && (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading this week's design...</p>
            </div>
          )}
          
          {!isLoadingWeekly && error && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <p className="text-destructive">Error loading weekly winner</p>
              <p className="text-xs text-muted-foreground">{String(error)}</p>
            </div>
          )}
          
          {!isLoadingWeekly && !error && !weeklyWinner && (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">No data returned from API</p>
            </div>
          )}
          
          {!isLoadingWeekly && !error && weeklyWinner && (
            <div className="flex flex-col items-center gap-6" data-testid="container-winner-product">
              {/* T-shirt Image with Quote Overlay - Matching Reference Design */}
              <div className="w-full max-w-lg">
                <div className="aspect-square bg-[#e5e1dc] rounded-lg overflow-hidden relative">
                  {/* T-shirt Mockup Image */}
                  <img
                    src={tshirtMockup}
                    alt={`T-shirt with quote: ${weeklyWinner.quote?.text || 'Quote'}`}
                    className="w-full h-full object-contain"
                    data-testid="img-product"
                  />
                  
                  {/* Quote Overlay - Positioned on Chest Area */}
                  <div 
                    className="absolute left-[15%] right-[15%]"
                    style={{ top: '28%' }}
                  >
                    {/* Quote Text - Elegant Serif, Centered */}
                    <p 
                      className="text-white text-center"
                      style={{ 
                        fontFamily: 'Georgia, "Times New Roman", serif',
                        fontSize: 'clamp(0.9rem, 3.5vw, 1.35rem)',
                        fontWeight: 400,
                        lineHeight: 1.3,
                        letterSpacing: '0.01em',
                      }}
                      data-testid="text-shirt-quote"
                    >
                      {`\u201C${weeklyWinner.quote?.text || 'Quote'}\u201D`}
                    </p>
                    
                    {/* Author Line with QR Code - Centered below quote */}
                    <div className="flex items-center justify-center gap-1.5 mt-2">
                      <p 
                        className="text-white"
                        style={{ 
                          fontFamily: 'Georgia, "Times New Roman", serif',
                          fontSize: 'clamp(0.65rem, 2vw, 0.85rem)',
                          fontWeight: 400,
                          fontStyle: 'italic',
                        }}
                        data-testid="text-shirt-author"
                      >
                        —{weeklyWinner.authorFirstName && weeklyWinner.authorLastName 
                          ? `${weeklyWinner.authorFirstName} ${weeklyWinner.authorLastName}`
                          : weeklyWinner.authorUsername || 'Anonymous'}
                      </p>
                      {/* QR Code - Matches author font height */}
                      {qrCodeUrl && (
                        <img 
                          src={qrCodeUrl} 
                          alt="QR code to quote-it.co"
                          className="h-3 w-3 md:h-4 md:w-4"
                          style={{ filter: 'invert(0.9)' }}
                          data-testid="img-qrcode"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase Button */}
              <div className="flex items-center justify-between w-full max-w-lg">
                <span className="text-3xl font-bold" data-testid="text-product-price">
                  ${weeklyWinner.product?.price ? parseFloat(weeklyWinner.product.price).toFixed(2) : '0.00'}
                </span>
                <Button
                  size="lg"
                  className="rounded-full px-8"
                  onClick={() => weeklyWinner.product?.id && handleAddToCart(weeklyWinner.product.id)}
                  data-testid="button-add-to-cart"
                >
                  Buy Now
                </Button>
              </div>
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
