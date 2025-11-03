import WinnerCard from "@/components/WinnerCard";
import QuoteCard from "@/components/QuoteCard";

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

export default function LeaderboardPage() {
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
      </div>
    </div>
  );
}
