import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import UserStats from "@/components/UserStats";
import QuoteCard from "@/components/QuoteCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Loader2, UserPlus, UserCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { QuoteWithAuthor } from "@shared/schema";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string;
};

type FollowStatus = {
  status: 'none' | 'following' | 'follower' | 'friends';
  isFollowing: boolean;
  isFollowedBy: boolean;
};

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Redirect if viewing own profile
  if (currentUser?.id === userId) {
    navigate("/profile");
    return null;
  }

  // Fetch user data
  const { data: profileUser, isLoading: userLoading } = useQuery<User>({
    queryKey: [`/api/users/${userId}`],
    enabled: !!userId,
  });

  // Fetch user's quotes
  const { data: userQuotes = [], isLoading: quotesLoading } = useQuery<QuoteWithAuthor[]>({
    queryKey: [`/api/quotes/user/${userId}`],
    enabled: !!userId,
  });

  // Fetch follow status
  const { data: followStatus } = useQuery<FollowStatus>({
    queryKey: ['/api/follow/status', userId],
    enabled: !!userId && !!currentUser,
  });

  // Follow user mutation
  const followMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/follow/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/follow/status', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/following'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      toast({
        title: "Following",
        description: "You are now following this user",
      });
    },
    onError: () => {
      toast({
        title: "Failed to follow",
        description: "Could not follow user. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Unfollow user mutation
  const unfollowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/follow/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/follow/status', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/following'] });
      queryClient.invalidateQueries({ queryKey: ['/api/friends'] });
      toast({
        title: "Unfollowed",
        description: "You have unfollowed this user",
      });
    },
    onError: () => {
      toast({
        title: "Failed to unfollow",
        description: "Could not unfollow user. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!userId) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 pt-16 flex items-center justify-center">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  if (userLoading) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 pt-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 pt-16 flex items-center justify-center">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const totalVotes = userQuotes.reduce((sum, q) => sum + q.voteCount, 0);
  const wins = 0;

  const username = profileUser.firstName && profileUser.lastName
    ? `${profileUser.firstName} ${profileUser.lastName}`
    : profileUser.firstName || profileUser.lastName || "Anonymous";

  const joinDate = profileUser.createdAt
    ? formatDistanceToNow(new Date(profileUser.createdAt), { addSuffix: true })
    : "recently";

  const renderFollowButton = () => {
    if (!currentUser) return null;

    const isFollowing = followStatus?.isFollowing ?? false;
    const isFollowedBy = followStatus?.isFollowedBy ?? false;
    const isFriends = isFollowing && isFollowedBy;

    if (isFriends) {
      return (
        <Button 
          variant="secondary" 
          onClick={() => unfollowMutation.mutate()}
          disabled={unfollowMutation.isPending}
          className="gap-2" 
          data-testid="button-friends"
        >
          {unfollowMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          Friends
        </Button>
      );
    }

    if (isFollowing) {
      return (
        <Button 
          variant="secondary" 
          onClick={() => unfollowMutation.mutate()}
          disabled={unfollowMutation.isPending}
          className="gap-2" 
          data-testid="button-following"
        >
          {unfollowMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="h-4 w-4" />
          )}
          Following
        </Button>
      );
    }

    if (isFollowedBy) {
      return (
        <Button
          onClick={() => followMutation.mutate()}
          disabled={followMutation.isPending}
          className="gap-2"
          data-testid="button-follow-back"
        >
          {followMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Follow Back
        </Button>
      );
    }

    return (
      <Button
        onClick={() => followMutation.mutate()}
        disabled={followMutation.isPending}
        className="gap-2"
        data-testid="button-follow"
      >
        {followMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        Follow
      </Button>
    );
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-3">
          {/* User Stats - Sticky on desktop */}
          <div className="md:col-span-1">
            <div className="md:sticky md:top-24 space-y-4">
              <UserStats
                username={username}
                joinDate={joinDate}
                postsCount={userQuotes.length}
                totalVotes={totalVotes}
                wins={wins}
                profileImageUrl={profileUser.profileImageUrl}
              />
              {renderFollowButton()}
            </div>
          </div>

          {/* User's Content */}
          <div className="md:col-span-2 space-y-8">
            {/* User's Quotes */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-display" data-testid="heading-user-quotes">
                Quotes by {username}
              </h2>
              {quotesLoading ? (
                <div className="flex justify-center py-8" data-testid="loading-quotes">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : userQuotes.length === 0 ? (
                <Card data-testid="empty-quotes">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No quotes yet
                  </CardContent>
                </Card>
              ) : (
                userQuotes.map((quote) => {
                  return (
                    <QuoteCard
                      key={quote.id}
                      id={quote.id}
                      content={quote.text}
                      author={quote.authorUsername || 'Unknown'}
                      authorId={quote.authorId}
                      authorProfileImageUrl={quote.authorProfileImageUrl}
                      upvotes={Math.max(0, quote.voteCount)}
                      downvotes={0}
                      timeAgo={formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
