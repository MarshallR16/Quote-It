import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck, UserPlus, UserMinus, User as UserIcon, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

type FollowingRelation = {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
  following: User;
};

type FollowerRelation = {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
  follower: User;
};

export default function FriendsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: friends = [], isLoading: friendsLoading } = useQuery<User[]>({
    queryKey: ["/api/friends"],
    enabled: !!user,
  });

  const { data: following = [], isLoading: followingLoading } = useQuery<FollowingRelation[]>({
    queryKey: ["/api/following"],
    enabled: !!user,
  });

  const { data: followers = [], isLoading: followersLoading } = useQuery<FollowerRelation[]>({
    queryKey: ["/api/followers"],
    enabled: !!user,
  });

  const followMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiRequest("POST", `/api/follow/${targetUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followers"] });
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

  const unfollowMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiRequest("DELETE", `/api/follow/${targetUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/following"] });
      queryClient.invalidateQueries({ queryKey: ["/api/followers"] });
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

  const followingIds = new Set(following.map(f => f.following.id));

  const followersNotFollowedBack = followers.filter(f => !followingIds.has(f.follower.id));

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold font-display">Friends & Following</h1>
          <Button
            variant="outline"
            onClick={() => navigate("/search")}
            data-testid="button-search-people"
          >
            <Search className="h-4 w-4 mr-2" />
            Find People
          </Button>
        </div>
        
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="friends" data-testid="tab-friends">
              Friends ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="following" data-testid="tab-following">
              Following ({following.length})
            </TabsTrigger>
            <TabsTrigger value="followers" data-testid="tab-followers">
              Followers ({followers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends">
            {friendsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <Card data-testid="empty-friends">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="mb-2">No friends yet</p>
                  <p className="text-sm">Friends are users who follow each other. Start following people!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {friends.map((friend) => (
                  <Card 
                    key={friend.id} 
                    className="hover-elevate cursor-pointer"
                    onClick={() => navigate(`/users/${friend.id}`)}
                    data-testid={`friend-${friend.id}`}
                  >
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={friend.profileImageUrl || undefined} alt={getUserName(friend)} />
                        <AvatarFallback>
                          <UserIcon className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <CardTitle className="text-base">
                          {getUserName(friend)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Mutual
                        </p>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="following">
            {followingLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : following.length === 0 ? (
              <Card data-testid="empty-following">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="mb-2">Not following anyone yet</p>
                  <p className="text-sm">Follow users to see their quotes in your feed!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {following.map((relation) => (
                  <Card 
                    key={relation.id}
                    data-testid={`following-${relation.following.id}`}
                  >
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                      <Avatar 
                        className="w-12 h-12 cursor-pointer" 
                        onClick={() => navigate(`/users/${relation.following.id}`)}
                      >
                        <AvatarImage src={relation.following.profileImageUrl || undefined} alt={getUserName(relation.following)} />
                        <AvatarFallback>
                          <UserIcon className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/users/${relation.following.id}`)}
                      >
                        <CardTitle className="text-base">
                          {getUserName(relation.following)}
                        </CardTitle>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          unfollowMutation.mutate(relation.following.id);
                        }}
                        disabled={unfollowMutation.isPending}
                        data-testid={`button-unfollow-${relation.following.id}`}
                      >
                        {unfollowMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                        <span className="ml-2">Unfollow</span>
                      </Button>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="followers">
            {followersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : followers.length === 0 ? (
              <Card data-testid="empty-followers">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="mb-2">No followers yet</p>
                  <p className="text-sm">Share your quotes to get more followers!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {followersNotFollowedBack.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Follow Back</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {followersNotFollowedBack.map((relation) => (
                        <Card 
                          key={relation.id}
                          data-testid={`follower-${relation.follower.id}`}
                        >
                          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <Avatar 
                              className="w-12 h-12 cursor-pointer"
                              onClick={() => navigate(`/users/${relation.follower.id}`)}
                            >
                              <AvatarImage src={relation.follower.profileImageUrl || undefined} alt={getUserName(relation.follower)} />
                              <AvatarFallback>
                                <UserIcon className="w-6 h-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => navigate(`/users/${relation.follower.id}`)}
                            >
                              <CardTitle className="text-base">
                                {getUserName(relation.follower)}
                              </CardTitle>
                            </div>
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                followMutation.mutate(relation.follower.id);
                              }}
                              disabled={followMutation.isPending}
                              data-testid={`button-follow-back-${relation.follower.id}`}
                            >
                              {followMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="h-4 w-4" />
                              )}
                              <span className="ml-2">Follow Back</span>
                            </Button>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
                
                {followers.filter(f => followingIds.has(f.follower.id)).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Already Following</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {followers.filter(f => followingIds.has(f.follower.id)).map((relation) => (
                        <Card 
                          key={relation.id}
                          className="hover-elevate cursor-pointer"
                          onClick={() => navigate(`/users/${relation.follower.id}`)}
                          data-testid={`follower-mutual-${relation.follower.id}`}
                        >
                          <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <Avatar className="w-12 h-12">
                              <AvatarImage src={relation.follower.profileImageUrl || undefined} alt={getUserName(relation.follower)} />
                              <AvatarFallback>
                                <UserIcon className="w-6 h-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <CardTitle className="text-base">
                                {getUserName(relation.follower)}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <UserCheck className="w-3 h-3" /> Mutual
                              </p>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
