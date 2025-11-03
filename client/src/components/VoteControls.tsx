import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface VoteControlsProps {
  initialUpvotes: number;
  initialDownvotes: number;
  userVote?: "up" | "down" | null;
  onVote?: (voteType: "up" | "down") => void;
}

export default function VoteControls({ 
  initialUpvotes, 
  initialDownvotes, 
  userVote = null,
  onVote 
}: VoteControlsProps) {
  const [currentVote, setCurrentVote] = useState<"up" | "down" | null>(userVote);
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);

  const netVotes = upvotes - downvotes;

  const handleVote = (voteType: "up" | "down") => {
    if (currentVote === voteType) {
      if (voteType === "up") {
        setUpvotes(upvotes - 1);
      } else {
        setDownvotes(downvotes - 1);
      }
      setCurrentVote(null);
    } else {
      if (currentVote === "up") {
        setUpvotes(upvotes - 1);
      } else if (currentVote === "down") {
        setDownvotes(downvotes - 1);
      }
      
      if (voteType === "up") {
        setUpvotes(upvotes + 1);
      } else {
        setDownvotes(downvotes + 1);
      }
      setCurrentVote(voteType);
    }
    
    onVote?.(voteType);
    console.log(`Vote ${voteType} triggered`);
  };

  return (
    <div className="flex items-center gap-2" data-testid="vote-controls">
      <Button
        size="icon"
        variant="ghost"
        className={`rounded-full ${currentVote === "up" ? "bg-primary text-primary-foreground" : ""}`}
        onClick={() => handleVote("up")}
        data-testid="button-upvote"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
      <span className="text-base font-semibold min-w-12 text-center" data-testid="text-vote-count">
        {netVotes > 0 ? `+${netVotes}` : netVotes}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className={`rounded-full ${currentVote === "down" ? "bg-primary text-primary-foreground" : ""}`}
        onClick={() => handleVote("down")}
        data-testid="button-downvote"
      >
        <ArrowDown className="w-5 h-5" />
      </Button>
    </div>
  );
}
