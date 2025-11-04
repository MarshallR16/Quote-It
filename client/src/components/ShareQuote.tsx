import { Share2, Copy, Check } from "lucide-react";
import { SiX, SiFacebook, SiLinkedin } from "react-icons/si";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ShareQuoteProps {
  quoteId: string;
  quoteText: string;
  authorName: string;
}

export default function ShareQuote({ quoteId, quoteText, authorName }: ShareQuoteProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  
  // Truncate quote if too long for social media
  const truncatedQuote = quoteText.length > 200 
    ? quoteText.substring(0, 197) + "..." 
    : quoteText;

  // Generate share text (URL will be determined at click time)
  const shareText = `"${truncatedQuote}" — ${authorName}`;

  const getQuoteUrl = () => {
    if (typeof window === 'undefined') return '';
    // Return the platform URL - Quote-It is a feed-based app without individual quote pages
    return `${window.location.origin}/`;
  };

  const handleCopyLink = async () => {
    const quoteUrl = getQuoteUrl();
    // Include the full quote in the share text since there's no individual quote page
    const shareTextWithUrl = `${shareText}\n\nDiscover more quotes at Quote-It: ${quoteUrl}`;
    
    try {
      // Check if clipboard API is available (requires HTTPS or localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareTextWithUrl);
      } else {
        // Fallback for non-HTTPS environments
        const textArea = document.createElement('textarea');
        textArea.value = shareTextWithUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Quote copied to clipboard",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please copy the text manually",
      });
    }
  };

  const handleTwitterShare = () => {
    const quoteUrl = getQuoteUrl();
    // Include hashtag and platform URL
    const shareTextWithHashtag = `${shareText}\n\n#QuoteIt ${quoteUrl}`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTextWithHashtag)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420,noopener,noreferrer');
  };

  const handleFacebookShare = () => {
    const quoteUrl = getQuoteUrl();
    // Facebook will use the quote as the share text
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(quoteUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420,noopener,noreferrer');
  };

  const handleLinkedInShare = () => {
    const quoteUrl = getQuoteUrl();
    // LinkedIn will preview the homepage
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(quoteUrl)}`;
    window.open(linkedInUrl, '_blank', 'width=550,height=420,noopener,noreferrer');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          data-testid={`button-share-${quoteId}`}
        >
          <Share2 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Share this quote</h4>
            <p className="text-sm text-muted-foreground line-clamp-3">
              "{truncatedQuote}"
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTwitterShare}
              className="gap-2"
              data-testid="button-share-twitter"
            >
              <SiX className="w-4 h-4" />
              X / Twitter
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleFacebookShare}
              className="gap-2"
              data-testid="button-share-facebook"
            >
              <SiFacebook className="w-4 h-4" />
              Facebook
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleLinkedInShare}
              className="gap-2"
              data-testid="button-share-linkedin"
            >
              <SiLinkedin className="w-4 h-4" />
              LinkedIn
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-2"
              data-testid="button-copy-link"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copy Link
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
