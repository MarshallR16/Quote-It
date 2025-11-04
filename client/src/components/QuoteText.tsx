import { useLocation } from "wouter";

interface QuoteTextProps {
  text: string;
}

export default function QuoteText({ text }: QuoteTextProps) {
  const [, navigate] = useLocation();

  const handleMentionClick = async (username: string) => {
    try {
      // Look up user by username
      const response = await fetch(`/api/users/by-username/${username}`);
      if (response.ok) {
        const user = await response.json();
        navigate(`/users/${user.id}`);
      }
    } catch (error) {
      console.error('Error looking up user:', error);
    }
  };

  // Parse text and find @mentions
  const parseText = () => {
    // Match @username pattern (letters, numbers, dots, underscores)
    const mentionRegex = /@([a-zA-Z0-9._]+)/g;
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
