import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface CreateQuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (content: string) => void;
}

const MAX_CHARS = 280;

export default function CreateQuoteModal({
  open,
  onOpenChange,
  onSubmit,
}: CreateQuoteModalProps) {
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit?.(content);
      console.log('Quote submitted:', content);
      setContent("");
      onOpenChange(false);
    }
  };

  const remainingChars = MAX_CHARS - content.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">Create Quote</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Share your thoughts..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-32 text-2xl resize-none border-0 focus-visible:ring-0 p-0"
            maxLength={MAX_CHARS}
            data-testid="input-quote-content"
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-xs ${remainingChars < 20 ? "text-destructive" : "text-muted-foreground"}`}
              data-testid="text-char-count"
            >
              {remainingChars} characters remaining
            </span>
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
                disabled={!content.trim() || content.length > MAX_CHARS}
                data-testid="button-post"
              >
                Post Quote
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
