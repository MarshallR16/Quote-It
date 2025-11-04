import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface VoteControlsProps {
  quoteId: string;
  initialVoteCount: number;
}

export default function VoteControls({ 
  quoteId,
  initialVoteCount,
}: VoteControlsProps) {
  const [currentVote, setCurrentVote] = useState<1 | -1 | null>(null);
  const [optimisticVoteCount, setOptimisticVoteCount] = useState(initialVoteCount);
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Load user's existing vote only if authenticated
  const { data: existingVote } = useQuery<{ value: number } | null>({
    queryKey: [`/api/votes/quote/${quoteId}`],
    enabled: isAuthenticated,
  });

  // Set initial vote state when loaded
  useEffect(() => {
    if (existingVote) {
      setCurrentVote(existingVote.value as 1 | -1);
    }
  }, [existingVote]);

  const voteMutation = useMutation({
    mutationFn: async (value: 1 | -1) => {
      const res = await apiRequest("POST", "/api/votes", { quoteId, value });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
  });

  const handleVote = (voteType: "up" | "down") => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }

    const value = voteType === "up" ? 1 : -1;
    
    // Optimistic update
    if (currentVote === value) {
      // Toggle off
      setOptimisticVoteCount(optimisticVoteCount - value);
      setCurrentVote(null);
    } else if (currentVote === null) {
      // New vote
      setOptimisticVoteCount(optimisticVoteCount + value);
      setCurrentVote(value);
    } else {
      // Change vote
      setOptimisticVoteCount(optimisticVoteCount - currentVote + value);
      setCurrentVote(value);
    }

    voteMutation.mutate(value);
  };

  return (
    <div className="flex items-center gap-2" data-testid="vote-controls">
      <Button
        size="icon"
        variant="ghost"
        className={`rounded-full ${currentVote === 1 ? "bg-primary text-primary-foreground" : ""}`}
        onClick={() => handleVote("up")}
        disabled={voteMutation.isPending}
        data-testid="button-upvote"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
      <span className="text-base font-semibold min-w-12 text-center" data-testid="text-vote-count">
        {optimisticVoteCount > 0 ? `+${optimisticVoteCount}` : optimisticVoteCount}
      </span>
      <Button
        size="icon"
        variant="ghost"
        className={`rounded-full ${currentVote === -1 ? "bg-primary text-primary-foreground" : ""}`}
        onClick={() => handleVote("down")}
        disabled={voteMutation.isPending}
        data-testid="button-downvote"
      >
        <ArrowDown className="w-5 h-5" />
      </Button>
    </div>
  );
}
