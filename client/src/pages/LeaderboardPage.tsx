import WinnerCard from "@/components/WinnerCard";
import QuoteCard from "@/components/QuoteCard";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

// TODO: remove mock functionality
const currentWinner = {
  weekNumber: 42,
  content: "Be yourself; everyone else is already taken",
  author: "Oscar Wilde",
  votes: 892,
};

const runnersUp = [
  {
    id: "2",
    content: "The future belongs to those who believe in the beauty of their dreams",
    author: "Eleanor Roosevelt",
    upvotes: 678,
    downvotes: 23,
    timeAgo: "3 days ago",
  },
  {
    id: "3",
    content: "Life is what happens when you're busy making other plans",
    author: "John Lennon",
    upvotes: 445,
    downvotes: 32,
    timeAgo: "2 days ago",
  },
  {
    id: "4",
    content: "In the middle of difficulty lies opportunity",
    author: "Albert Einstein",
    upvotes: 234,
    downvotes: 18,
    timeAgo: "1 day ago",
  },
];

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
  // Fetch hall of fame users
  const { data: hallOfFame, isLoading: isLoadingHall } = useQuery<HallOfFameUser[]>({
    queryKey: ["/api/hall-of-fame"],
  });
  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h2 className="text-3xl font-bold font-display mb-2">This Week's Leader</h2>
          <p className="text-muted-foreground mb-6">
            The most voted quote will be available as a T-shirt
          </p>
          <WinnerCard {...currentWinner} />
        </div>

        <div>
          <h3 className="text-2xl font-bold font-display mb-4">Runners Up</h3>
          <div className="grid gap-6 md:grid-cols-2">
            {runnersUp.map((quote) => (
              <QuoteCard key={quote.id} {...quote} />
            ))}
          </div>
        </div>

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
