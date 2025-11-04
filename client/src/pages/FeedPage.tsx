import { useState } from "react";
import QuoteCard from "@/components/QuoteCard";
import FeedFilters, { type FilterType } from "@/components/FeedFilters";
import CreateQuoteModal from "@/components/CreateQuoteModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useSwipeable } from "react-swipeable";

interface QuoteWithAuthor {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  voteCount: number;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
}

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("recent");
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const { data: quotes, isLoading } = useQuery<QuoteWithAuthor[]>({
    queryKey: ["/api/quotes"],
    enabled: activeFilter !== "friends",
  });

  const { data: friendsQuotes, isLoading: friendsLoading } = useQuery<QuoteWithAuthor[]>({
    queryKey: ["/api/quotes/friends"],
    enabled: activeFilter === "friends",
  });

  // Tab order for swiping
  const tabOrder: FilterType[] = ["top", "friends", "recent"];
  
  const handleSwipe = (direction: "left" | "right") => {
    const currentIndex = tabOrder.indexOf(activeFilter);
    
    if (direction === "left" && currentIndex < tabOrder.length - 1) {
      setActiveFilter(tabOrder[currentIndex + 1]);
    } else if (direction === "right" && currentIndex > 0) {
      setActiveFilter(tabOrder[currentIndex - 1]);
    }
  };

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe("left"),
    onSwipedRight: () => handleSwipe("right"),
    trackMouse: false,
    preventScrollOnSwipe: true,
  });

  const getSortedQuotes = () => {
    const sourceQuotes = activeFilter === "friends" ? friendsQuotes : quotes;
    if (!sourceQuotes) return [];
    
    const sorted = [...sourceQuotes];
    if (activeFilter === "recent") {
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (activeFilter === "top") {
      return sorted.sort((a, b) => b.voteCount - a.voteCount);
    } else if (activeFilter === "friends") {
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return sorted;
  };

  const currentLoading = activeFilter === "friends" ? friendsLoading : isLoading;
  const sortedQuotes = getSortedQuotes();

  return (
    <div className="min-h-screen pb-20 md:pb-8">
      <FeedFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div {...swipeHandlers} className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {currentLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading quotes...</p>
          </div>
        ) : sortedQuotes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg mb-2">No quotes yet</p>
            <p className="text-sm text-muted-foreground">Be the first to share a quote!</p>
          </div>
        ) : (
          sortedQuotes.map((quote) => {
            return (
              <QuoteCard
                key={quote.id}
                id={quote.id}
                content={quote.text}
                author={quote.authorUsername || 'Unknown'}
                authorId={quote.authorId}
                upvotes={Math.max(0, quote.voteCount)}
                downvotes={Math.max(0, -quote.voteCount)}
                timeAgo={formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
              />
            );
          })
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
