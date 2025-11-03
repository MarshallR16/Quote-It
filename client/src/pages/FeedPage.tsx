import { useState } from "react";
import QuoteCard from "@/components/QuoteCard";
import FeedFilters, { type FilterType } from "@/components/FeedFilters";
import CreateQuoteModal from "@/components/CreateQuoteModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface Quote {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  voteCount: number;
}

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("recent");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const getSortedQuotes = () => {
    if (!quotes) return [];
    
    const sorted = [...quotes];
    if (activeFilter === "recent") {
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (activeFilter === "top") {
      return sorted.sort((a, b) => b.voteCount - a.voteCount);
    }
    return sorted;
  };

  const sortedQuotes = getSortedQuotes();

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <FeedFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading quotes...</p>
          </div>
        ) : sortedQuotes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg mb-2">No quotes yet</p>
            <p className="text-sm text-muted-foreground">Be the first to share a quote!</p>
          </div>
        ) : (
          sortedQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              id={quote.id}
              content={quote.text}
              author={quote.authorId}
              upvotes={Math.max(0, quote.voteCount)}
              downvotes={Math.max(0, -quote.voteCount)}
              timeAgo={formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
            />
          ))
        )}
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
