import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { User, Trash2, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isOwner = user?.id === authorId;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/quotes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/personalized"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/user"] });
      toast({
        title: "Quote deleted",
        description: "Your quote has been removed.",
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Failed to delete quote. Please try again.";
      toast({
        title: "Cannot delete quote",
        description: message.includes("weekly winner") 
          ? "This quote won a weekly competition and cannot be deleted."
          : message,
        variant: "destructive",
      });
    },
  });

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
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-shrink">
          <Avatar className="w-8 h-8 flex-shrink-0" data-testid={`avatar-author-${id}`}>
            <AvatarImage src={authorProfileImageUrl || undefined} alt={author} />
            <AvatarFallback>
              <User className="w-4 h-4" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            {authorId ? (
              <button
                onClick={handleAuthorClick}
                className="text-sm font-medium mb-1 hover:underline text-left truncate block max-w-[150px] sm:max-w-[200px]"
                data-testid="text-author"
              >
                {author}
              </button>
            ) : (
              <p className="text-sm font-medium mb-1 truncate max-w-[150px] sm:max-w-[200px]" data-testid="text-author">
                {author}
              </p>
            )}
            <p className="text-xs text-muted-foreground" data-testid="text-time">
              {timeAgo}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isOwner && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-quote-${id}`}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
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

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your quote and all its votes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
