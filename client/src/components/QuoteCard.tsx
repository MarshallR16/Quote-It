import { Card } from "@/components/ui/card";
import VoteControls from "./VoteControls";
import { useLocation } from "wouter";

interface QuoteCardProps {
  id: string;
  content: string;
  author: string;
  authorId?: string;
  upvotes: number;
  downvotes: number;
  timeAgo: string;
}

export default function QuoteCard({
  id,
  content,
  author,
  authorId,
  upvotes,
  downvotes,
  timeAgo,
}: QuoteCardProps) {
  const [, navigate] = useLocation();

  const handleAuthorClick = () => {
    if (authorId) {
      navigate(`/users/${authorId}`);
    }
  };

  return (
    <Card className="p-6 hover-elevate" data-testid={`card-quote-${id}`}>
      <blockquote className="text-2xl font-medium leading-tight mb-4">
        "{content}"
      </blockquote>
      <div className="flex items-center justify-between">
        <div>
          {authorId ? (
            <button
              onClick={handleAuthorClick}
              className="text-sm font-medium mb-1 hover:underline text-left"
              data-testid="text-author"
            >
              {author}
            </button>
          ) : (
            <p className="text-sm font-medium mb-1" data-testid="text-author">
              {author}
            </p>
          )}
          <p className="text-xs text-muted-foreground" data-testid="text-time">
            {timeAgo}
          </p>
        </div>
        <VoteControls
          quoteId={id}
          initialVoteCount={upvotes}
        />
      </div>
    </Card>
  );
}
