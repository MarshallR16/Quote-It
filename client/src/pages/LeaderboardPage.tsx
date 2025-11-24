import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Trophy, User, ShoppingBag } from "lucide-react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface HallOfFameUser {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  weeklyWins: number;
  totalVotes: number;
}

export default function LeaderboardPage() {
  const [, setLocation] = useLocation();

  // Fetch most recent weekly winner
  const { data: currentWinner, isLoading: isLoadingWinner } = useQuery<any>({
    queryKey: ["/api/weekly-winner/current"],
  });

  // Fetch hall of fame users
  const { data: hallOfFame, isLoading: isLoadingHall } = useQuery<HallOfFameUser[]>({
    queryKey: ["/api/hall-of-fame"],
  });

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Current T-Shirt for Sale */}
        {isLoadingWinner ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading current winner...</p>
          </div>
        ) : currentWinner ? (
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
                        {currentWinner.voteCount} votes • ${currentWinner.productPrice || '29.99'}
                      </p>
                    </div>
                  </div>
                  {currentWinner.createdAt && (
                    <p className="text-sm text-muted-foreground">
                      Selected {formatDistanceToNow(new Date(currentWinner.createdAt), { addSuffix: true })}
                    </p>
                  )}
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

        {/* Hall of Fame Section */}
        <div className="pt-8 border-t">
          <div className="flex items-center gap-3 mb-6">
            <Trophy className="w-8 h-8" />
            <div>
              <h3 className="text-2xl font-bold font-display">Hall of Fame</h3>
              <p className="text-muted-foreground">Top users by wins and total votes</p>
            </div>
          </div>

          {isLoadingHall ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading hall of fame...</p>
            </div>
          ) : hallOfFame && hallOfFame.length > 0 ? (
            <div className="space-y-4">
              {hallOfFame.map((user, index) => {
                const displayName = user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}`
                  : user.username;
                
                return (
                  <Card key={user.userId} className="p-6" data-testid={`hall-of-fame-user-${index}`}>
                    <div className="flex gap-4 items-center">
                      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xl font-bold">#{index + 1}</span>
                      </div>
                      <Avatar className="w-10 h-10" data-testid={`avatar-user-${index}`}>
                        <AvatarImage src={user.profileImageUrl || undefined} alt={displayName} />
                        <AvatarFallback>
                          <User className="w-5 h-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-lg font-medium mb-1">{displayName}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Trophy className="w-4 h-4" />
                            <span data-testid={`wins-count-${index}`}>{user.weeklyWins} {user.weeklyWins === 1 ? 'win' : 'wins'}</span>
                          </div>
                          <span>•</span>
                          <span data-testid={`votes-count-${index}`}>{user.totalVotes.toLocaleString()} total votes</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-muted/30 rounded-md">
              <p className="text-muted-foreground text-lg mb-2">Hall of Fame is empty</p>
              <p className="text-sm text-muted-foreground">
                The top users with most wins and votes will appear here!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
