import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck, UserPlus, Clock, X, User as UserIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

type Friend = {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  createdAt: string;
  friend: User;
};

type FriendRequest = {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  createdAt: string;
  requester: User;
};

export default function FriendsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch friends
  const { data: friends = [], isLoading: friendsLoading } = useQuery<Friend[]>({
    queryKey: ["/api/friends"],
    enabled: !!user,
  });

  // Fetch pending requests
  const { data: requests = [], isLoading: requestsLoading } = useQuery<FriendRequest[]>({
    queryKey: ["/api/friends/requests"],
    enabled: !!user,
  });

  // Accept request mutation
  const acceptMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      return apiRequest("POST", `/api/friends/accept/${friendshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
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

  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      return apiRequest("POST", `/api/friends/reject/${friendshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      toast({
        title: "Friend request rejected",
      });
    },
    onError: () => {
      toast({
        title: "Failed to reject request",
        description: "Could not reject friend request. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen pb-20 md:pb-8 pt-16 flex items-center justify-center">
        <p className="text-muted-foreground">Please log in to view friends</p>
      </div>
    );
  }

  const getUserName = (user: User | undefined | null) => {
    if (!user) return "Anonymous";
    return user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName || user.email || "Anonymous";
  };

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Friend Requests Section */}
        <div>
          <h2 className="text-3xl font-bold font-display mb-6">Friend Requests</h2>
          {requestsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card data-testid="empty-requests">
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending friend requests
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id} data-testid={`request-${request.id}`}>
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0 pb-2">
                    <Avatar className="w-12 h-12" data-testid={`avatar-requester-${request.id}`}>
                      <AvatarImage src={request.requester.profileImageUrl || undefined} alt={getUserName(request.requester)} />
                      <AvatarFallback>
                        <UserIcon className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle 
                        className="text-base cursor-pointer hover:underline"
                        onClick={() => navigate(`/users/${request.requester.id}`)}
                        data-testid={`text-requester-${request.id}`}
                      >
                        {getUserName(request.requester)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Sent you a friend request
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptMutation.mutate(request.id)}
                        disabled={acceptMutation.isPending}
                        data-testid={`button-accept-${request.id}`}
                      >
                        {acceptMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                        <span className="ml-2">Accept</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectMutation.mutate(request.id)}
                        disabled={rejectMutation.isPending}
                        data-testid={`button-reject-${request.id}`}
                      >
                        {rejectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        <span className="ml-2">Reject</span>
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Friends List Section */}
        <div>
          <h2 className="text-3xl font-bold font-display mb-6">Your Friends</h2>
          {friendsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : friends.length === 0 ? (
            <Card data-testid="empty-friends">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="mb-2">No friends yet</p>
                <p className="text-sm">Start adding friends to see their quotes in your feed!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {friends.map((friendship) => (
                <Card 
                  key={friendship.id} 
                  className="hover-elevate cursor-pointer"
                  onClick={() => navigate(`/users/${friendship.friend.id}`)}
                  data-testid={`friend-${friendship.id}`}
                >
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <Avatar className="w-12 h-12" data-testid={`avatar-friend-${friendship.id}`}>
                      <AvatarImage src={friendship.friend.profileImageUrl || undefined} alt={getUserName(friendship.friend)} />
                      <AvatarFallback>
                        <UserIcon className="w-6 h-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-base" data-testid={`text-friend-${friendship.id}`}>
                        {getUserName(friendship.friend)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {friendship.friend.email}
                      </p>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
