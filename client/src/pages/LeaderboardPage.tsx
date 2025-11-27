import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, User, ShoppingBag, Calendar, Award } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

interface ShirtArchiveItem {
  winnerId: string;
  quoteId: string;
  quoteText: string;
  voteCount: number;
  authorId: string;
  authorUsername: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorProfileImageUrl: string | null;
  productId: string | null;
  productName: string | null;
  productPrice: string | null;
  productImageUrl: string | null;
  productIsActive: boolean | null;
  weekStartDate: string;
  weekEndDate: string;
  finalVoteCount: number;
  createdAt: string;
}

export default function LeaderboardPage() {
  const [, setLocation] = useLocation();

  // Fetch most recent weekly winner
  const { data: currentWinner, isLoading: isLoadingWinner } = useQuery<any>({
    queryKey: ["/api/weekly-winner/current"],
  });

  // Fetch shirt archive - all past winning shirts
  const { data: shirtArchive = [], isLoading: isLoadingArchive } = useQuery<ShirtArchiveItem[]>({
    queryKey: ["/api/shirt-archive"],
  });

  const getAuthorDisplayName = (item: ShirtArchiveItem) => {
    if (item.authorFirstName && item.authorLastName) {
      return `${item.authorFirstName} ${item.authorLastName}`;
    }
    return item.authorUsername || 'Anonymous';
  };

  const formatWeekRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  };

  return (
    <div className="min-h-screen pb-32 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Current T-Shirt for Sale */}
        {isLoadingWinner ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading current winner...</p>
          </div>
        ) : currentWinner && currentWinner.quoteText ? (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-bold font-display mb-2">Now Available</h2>
                <p className="text-muted-foreground">
                  Last week's winning quote, now on a premium T-shirt
                </p>
              </div>
              <Button
                onClick={() => setLocation("/store")}
                className="gap-2"
                data-testid="button-shop-winner"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop Now
              </Button>
            </div>
            <Card className="overflow-hidden" data-testid="card-current-winner">
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Trophy className="w-8 h-8 text-primary" />
                  </div>
                  <blockquote className="text-2xl md:text-3xl font-display leading-relaxed">
                    "{currentWinner.quoteText}"
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10" data-testid="avatar-winner">
                      <AvatarImage 
                        src={currentWinner.authorProfileImageUrl || undefined} 
                        alt={currentWinner.authorUsername} 
                      />
                      <AvatarFallback>
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="font-medium" data-testid="text-winner-author">
                        {currentWinner.authorFirstName && currentWinner.authorLastName
                          ? `${currentWinner.authorFirstName} ${currentWinner.authorLastName}`
                          : currentWinner.authorUsername}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {currentWinner.voteCount || currentWinner.finalVoteCount} votes • ${currentWinner.productPrice || '29.99'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-md">
            <p className="text-muted-foreground text-lg mb-2">No winner selected yet</p>
            <p className="text-sm text-muted-foreground">
              The first weekly winner will appear here!
            </p>
          </div>
        )}

        {/* Shirt Archive Section */}
        <div className="pt-8 border-t">
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-8 h-8" />
            <div>
              <h3 className="text-2xl font-bold font-display">Shirt Archive</h3>
              <p className="text-muted-foreground">All past winning quotes and their shirts</p>
            </div>
          </div>

          {isLoadingArchive ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading shirt archive...</p>
            </div>
          ) : shirtArchive && shirtArchive.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {shirtArchive.map((item, index) => (
                <Card 
                  key={item.winnerId} 
                  className="overflow-hidden hover-elevate cursor-pointer"
                  onClick={() => item.productId && item.productIsActive && setLocation(`/checkout/${item.productId}`)}
                  data-testid={`archive-shirt-${index}`}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col space-y-4">
                      {/* Week Badge */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{formatWeekRange(item.weekStartDate, item.weekEndDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium">{item.finalVoteCount} votes</span>
                        </div>
                      </div>

                      {/* Quote */}
                      <blockquote className="text-lg font-display leading-relaxed">
                        "{item.quoteText}"
                      </blockquote>

                      {/* Author */}
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage 
                            src={item.authorProfileImageUrl || undefined} 
                            alt={getAuthorDisplayName(item)} 
                          />
                          <AvatarFallback>
                            <User className="w-4 h-4" />
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          — {getAuthorDisplayName(item)}
                        </span>
                      </div>

                      {/* Product Info */}
                      {item.productId && item.productIsActive ? (
                        <div className="pt-2 border-t flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Still available
                          </span>
                          <Button size="sm" variant="outline" className="gap-1">
                            <ShoppingBag className="w-3 h-3" />
                            ${item.productPrice || '29.99'}
                          </Button>
                        </div>
                      ) : (
                        <div className="pt-2 border-t">
                          <span className="text-sm text-muted-foreground">
                            No longer available
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-md">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg mb-2">No winning shirts yet</p>
              <p className="text-sm text-muted-foreground">
                Past winning quotes and their shirts will appear here!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
