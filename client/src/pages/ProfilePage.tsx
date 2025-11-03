import UserStats from "@/components/UserStats";
import QuoteCard from "@/components/QuoteCard";

// TODO: remove mock functionality
const userQuotes = [
  {
    id: "1",
    content: "The only way to do great work is to love what you do",
    author: "Me",
    upvotes: 156,
    downvotes: 12,
    timeAgo: "2 hours ago",
  },
  {
    id: "2",
    content: "Innovation distinguishes between a leader and a follower",
    author: "Me",
    upvotes: 89,
    downvotes: 5,
    timeAgo: "1 day ago",
  },
  {
    id: "3",
    content: "Stay hungry, stay foolish",
    author: "Me",
    upvotes: 234,
    downvotes: 8,
    timeAgo: "3 days ago",
  },
];

export default function ProfilePage() {
  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* User Stats - Sticky on desktop */}
          <div className="md:col-span-1">
            <div className="md:sticky md:top-24">
              <UserStats
                username="JohnDoe"
                joinDate="January 2024"
                postsCount={42}
                totalVotes={1234}
                wins={3}
              />
            </div>
          </div>

          {/* User's Quotes */}
          <div className="md:col-span-2 space-y-6">
            <h2 className="text-2xl font-bold font-display">My Quotes</h2>
            {userQuotes.map((quote) => (
              <QuoteCard key={quote.id} {...quote} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
