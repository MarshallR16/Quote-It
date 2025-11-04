import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface QuoteTextProps {
  text: string;
}

export default function QuoteText({ text }: QuoteTextProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleMentionClick = async (username: string) => {
    try {
      // Normalize username to lowercase for lookup
      const normalizedUsername = username.toLowerCase();
      const response = await fetch(`/api/users/by-username/${encodeURIComponent(normalizedUsername)}`);
      
      if (response.ok) {
        const user = await response.json();
        navigate(`/users/${user.id}`);
      } else if (response.status === 404) {
        toast({
          variant: "destructive",
          title: "User not found",
          description: `@${username} doesn't exist`,
        });
      } else {
        throw new Error('Failed to lookup user');
      }
    } catch (error) {
      console.error('Error looking up user:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load user profile",
      });
    }
  };

  // Parse text and find @mentions
  const parseText = () => {
    // Match @username pattern - matches the username format (letters, numbers, dots)
    // This matches firstname.lastname or firstname.lastname2 etc
    const mentionRegex = /@([a-z0-9.]+)/gi;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add clickable mention
      const username = match[1];
      parts.push(
        <button
          key={`mention-${key++}`}
          onClick={(e) => {
            e.stopPropagation();
            handleMentionClick(username);
          }}
          className="text-primary font-medium hover:underline"
          data-testid={`mention-${username}`}
          aria-label={`Go to ${username}'s profile`}
        >
          @{username}
        </button>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : [text];
  };

  return <>{parseText()}</>;
}
