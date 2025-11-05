import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";
import VoteControls from "./VoteControls";
import QuoteText from "./QuoteText";
import ShareQuote from "./ShareQuote";
import { useLocation } from "wouter";

interface QuoteCardProps {
  id: string;
  content: string;
  author: string;
  authorId?: string;
  authorProfileImageUrl?: string | null;
  upvotes: number;
  downvotes: number;
  timeAgo: string;
}

export default function QuoteCard({
  id,
  content,
  author,
  authorId,
  authorProfileImageUrl,
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
        "<QuoteText text={content} />"
      </blockquote>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8" data-testid={`avatar-author-${id}`}>
            <AvatarImage src={authorProfileImageUrl || undefined} alt={author} />
            <AvatarFallback>
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
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
        </div>
        <div className="flex items-center gap-2">
          <ShareQuote 
            quoteId={id}
            quoteText={content}
            authorName={author}
          />
          <VoteControls
            quoteId={id}
            initialVoteCount={upvotes}
          />
        </div>
      </div>
    </Card>
  );
}
