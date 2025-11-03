import { useState } from "react";
import QuoteCard from "@/components/QuoteCard";
import FeedFilters, { type FilterType } from "@/components/FeedFilters";
import CreateQuoteModal from "@/components/CreateQuoteModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

// TODO: remove mock functionality
const mockQuotes = [
  {
    id: "1",
    content: "The only way to do great work is to love what you do",
    author: "Steve Jobs",
    upvotes: 156,
    downvotes: 12,
    timeAgo: "2 hours ago",
  },
  {
    id: "2",
    content: "Be yourself; everyone else is already taken",
    author: "Oscar Wilde",
    upvotes: 892,
    downvotes: 45,
    timeAgo: "5 hours ago",
  },
  {
    id: "3",
    content: "In the middle of difficulty lies opportunity",
    author: "Albert Einstein",
    upvotes: 234,
    downvotes: 18,
    timeAgo: "1 day ago",
  },
  {
    id: "4",
    content: "Life is what happens when you're busy making other plans",
    author: "John Lennon",
    upvotes: 445,
    downvotes: 32,
    timeAgo: "2 days ago",
  },
  {
    id: "5",
    content: "The future belongs to those who believe in the beauty of their dreams",
    author: "Eleanor Roosevelt",
    upvotes: 678,
    downvotes: 23,
    timeAgo: "3 days ago",
  },
];

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("recent");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <FeedFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {mockQuotes.map((quote) => (
          <QuoteCard key={quote.id} {...quote} />
        ))}
      </div>

      {/* Mobile FAB */}
      <Button
        size="icon"
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-lg"
        onClick={() => setCreateModalOpen(true)}
        data-testid="button-fab-create"
      >
        <Plus className="w-6 h-6" />
      </Button>

      <CreateQuoteModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
