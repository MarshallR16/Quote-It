import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import UserStats from "@/components/UserStats";
import QuoteCard from "@/components/QuoteCard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { Loader2, UserPlus, UserCheck, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type QuoteWithAuthor = {
  id: string;
  text: string;
  authorId: string;
  voteCount: number;
  createdAt: string;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorEmail: string | null;
};

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
};

type FriendshipStatus = {
  status: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  friendshipId?: string;
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

  // Fetch friendship status
  const { data: friendshipStatus } = useQuery<FriendshipStatus>({
    queryKey: [`/api/friends/status/${userId}`],
    enabled: !!userId && !!currentUser,
  });

  // Send friend request mutation
  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/friends/request`, { friendId: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/friends/status/${userId}`] });
      toast({
        title: "Friend request sent",
        description: "Your friend request has been sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Failed to send request",
        description: "Could not send friend request. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Accept friend request mutation
  const acceptRequestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/friends/accept/${friendshipStatus?.friendshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/friends/status/${userId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      toast({
        title: "Friend request accepted",
        description: "You are now friends!",
      });
    },
    onError: () => {
      toast({
        title: "Failed to accept request",
        description: "Could not accept friend request. Please try again.",
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
    : profileUser.firstName || profileUser.email || "Anonymous";

  const joinDate = profileUser.createdAt
    ? formatDistanceToNow(new Date(profileUser.createdAt), { addSuffix: true })
    : "recently";

  const renderFriendButton = () => {
    if (!currentUser) return null;

    if (!friendshipStatus || friendshipStatus.status === 'none') {
      return (
        <Button
          onClick={() => sendRequestMutation.mutate()}
          disabled={sendRequestMutation.isPending}
          className="gap-2"
          data-testid="button-add-friend"
        >
          {sendRequestMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Add Friend
        </Button>
      );
    }

    if (friendshipStatus.status === 'pending_sent') {
      return (
        <Button variant="secondary" disabled className="gap-2" data-testid="button-request-pending">
          <Clock className="h-4 w-4" />
          Request Pending
        </Button>
      );
    }

    if (friendshipStatus.status === 'pending_received') {
      return (
        <Button
          onClick={() => acceptRequestMutation.mutate()}
          disabled={acceptRequestMutation.isPending}
          className="gap-2"
          data-testid="button-accept-request"
        >
          {acceptRequestMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Accept Friend Request
        </Button>
      );
    }

    if (friendshipStatus.status === 'accepted') {
      return (
        <Button variant="secondary" disabled className="gap-2" data-testid="button-friends">
          <UserCheck className="h-4 w-4" />
          Friends
        </Button>
      );
    }

    return null;
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
              />
              {renderFriendButton()}
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
                  const firstName = quote.authorFirstName?.trim();
                  const lastName = quote.authorLastName?.trim();
                  const email = quote.authorEmail?.trim();

                  const authorName = (firstName && lastName)
                    ? `${firstName} ${lastName}`
                    : firstName || lastName || email || 'Anonymous';

                  return (
                    <QuoteCard
                      key={quote.id}
                      id={quote.id}
                      content={quote.text}
                      author={authorName}
                      authorId={quote.authorId}
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
