import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

interface CreateQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_CHARS = 280;

export default function CreateQuoteModal({
  open,
  onOpenChange,
}: CreateQuoteModalProps) {
  const [content, setContent] = useState("");
  const { toast } = useToast();

  // Fetch daily post limit
  const { data: postLimit, refetch: refetchLimit } = useQuery<{ canPost: boolean; remaining: number; limit: number }>({
    queryKey: ["/api/users/daily-post-limit"],
    enabled: open, // Only fetch when modal is open
  });

  const createQuoteMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/quotes", { text });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      refetchLimit(); // Refetch the limit after posting
      toast({
        title: "Quote posted!",
        description: "Your quote has been shared with the community.",
      });
      setContent("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to post quote",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (content.trim()) {
      createQuoteMutation.mutate(content);
    }
  };

  const remainingChars = MAX_CHARS - content.length;
  const limitReached = postLimit && !postLimit.canPost;
  const isSubmitDisabled = !content.trim() || content.length > MAX_CHARS || createQuoteMutation.isPending || limitReached;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Create Quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {limitReached && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive" data-testid="alert-limit-reached">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm">Daily limit reached. Come back tomorrow!</p>
            </div>
          )}
          <Textarea
            placeholder="Share your thoughts..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-32 text-2xl resize-none border-0 focus-visible:ring-0 p-0"
            maxLength={MAX_CHARS}
            disabled={limitReached}
            data-testid="input-quote-content"
          />
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span
                className={`text-xs ${remainingChars < 20 ? "text-destructive" : "text-muted-foreground"}`}
                data-testid="text-char-count"
              >
                {remainingChars} characters remaining
              </span>
              {postLimit && (
                <span className="text-xs text-muted-foreground" data-testid="text-posts-remaining">
                  {postLimit.remaining} {postLimit.remaining === 1 ? 'post' : 'posts'} left today
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                className="rounded-full"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                data-testid="button-post"
              >
                {createQuoteMutation.isPending ? "Posting..." : "Post Quote"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
