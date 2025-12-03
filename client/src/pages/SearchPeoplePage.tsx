import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, UserPlus, UserMinus, User as UserIcon, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  username: string | null;
};

type FollowingRelation = {
  id: string;
  followerId: string;
  followingId: string;
  following: User;
};

export default function SearchPeoplePage() {
  const { user: currentUser, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading: searchLoading } = useQuery<{ users: User[] }>({
    queryKey: ["/api/users/search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        return { users: [] };
      }
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(debouncedQuery)}`);
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  const { data: following = [] } = useQuery<FollowingRelation[]>({
    queryKey: ["/api/following"],
    enabled: isAuthenticated,
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

  const followingIds = new Set(following.map(f => f.following.id));

  const getUserName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.firstName || user.username || "Anonymous";
  };

  const filteredResults = (searchResults?.users || []).filter(u => u.id !== currentUser?.id);

  return (
    <div className="min-h-screen pb-20 md:pb-8 pt-16">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold font-display mb-6">Search People</h1>
        
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-people"
          />
        </div>

        {debouncedQuery.length >= 2 ? (
          searchLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredResults.length === 0 ? (
            <Card data-testid="empty-search-results">
              <CardContent className="py-8 text-center text-muted-foreground">
                <p className="mb-2">No users found</p>
                <p className="text-sm">Try a different search term</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredResults.map((user) => {
                const isFollowing = followingIds.has(user.id);
                return (
                  <Card 
                    key={user.id}
                    data-testid={`search-result-${user.id}`}
                  >
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                      <Avatar 
                        className="w-12 h-12 cursor-pointer"
                        onClick={() => navigate(`/users/${user.id}`)}
                      >
                        <AvatarImage src={user.profileImageUrl || undefined} alt={getUserName(user)} />
                        <AvatarFallback>
                          <UserIcon className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/users/${user.id}`)}
                      >
                        <CardTitle className="text-base">
                          {getUserName(user)}
                        </CardTitle>
                        {user.username && (
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                        )}
                      </div>
                      {isAuthenticated && (
                        isFollowing ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              unfollowMutation.mutate(user.id);
                            }}
                            disabled={unfollowMutation.isPending}
                            data-testid={`button-unfollow-${user.id}`}
                          >
                            {unfollowMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserMinus className="h-4 w-4" />
                            )}
                            <span className="ml-2">Unfollow</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              followMutation.mutate(user.id);
                            }}
                            disabled={followMutation.isPending}
                            data-testid={`button-follow-${user.id}`}
                          >
                            {followMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                            <span className="ml-2">Follow</span>
                          </Button>
                        )
                      )}
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Find people to follow</p>
              <p className="text-sm">Enter at least 2 characters to search</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
