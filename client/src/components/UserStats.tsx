import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { User, Camera, Users } from "lucide-react";
import { useLocation } from "wouter";

interface UserStatsProps {
  username: string;
  joinDate: string;
  postsCount: number;
  totalVotes: number;
  wins: number;
  profileImageUrl?: string | null;
  onEditProfilePicture?: () => void;
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
  showSocialStats?: boolean;
}

export default function UserStats({
  username,
  joinDate,
  postsCount,
  totalVotes,
  wins,
  profileImageUrl,
  onEditProfilePicture,
  followersCount = 0,
  followingCount = 0,
  friendsCount = 0,
  showSocialStats = false,
}: UserStatsProps) {
  const [, navigate] = useLocation();
  
  const stats = [
    { label: "Posts", value: postsCount },
    { label: "Total Votes", value: totalVotes },
    { label: "Wins", value: wins },
  ];

  const socialStats = [
    { label: "Followers", value: followersCount },
    { label: "Following", value: followingCount },
    { label: "Friends", value: friendsCount },
  ];

  return (
    <Card className="p-6" data-testid="card-user-stats">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <Avatar className="w-24 h-24" data-testid="avatar-profile">
            <AvatarImage src={profileImageUrl || undefined} alt={username} />
            <AvatarFallback>
              <User className="w-12 h-12" />
            </AvatarFallback>
          </Avatar>
          {onEditProfilePicture && (
            <Button
              size="icon"
              variant="default"
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full"
              onClick={onEditProfilePicture}
              data-testid="button-edit-profile-picture"
            >
              <Camera className="w-4 h-4" />
            </Button>
          )}
        </div>
        <h2 className="text-2xl font-bold mb-1" data-testid="text-username">
          {username}
        </h2>
        <p className="text-xs text-muted-foreground" data-testid="text-join-date">
          Joined {joinDate}
        </p>
      </div>

      {/* Social Stats - Clickable */}
      {showSocialStats && (
        <div 
          className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b cursor-pointer hover-elevate rounded-md py-2"
          onClick={() => navigate("/friends")}
          data-testid="social-stats-container"
        >
          {socialStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="text-2xl font-bold mb-1"
                data-testid={`text-stat-${stat.label.toLowerCase()}`}
              >
                {stat.value}
              </div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Users className="w-3 h-3" />
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <div
              className="text-3xl font-bold mb-1"
              data-testid={`text-stat-${stat.label.toLowerCase().replace(" ", "-")}`}
            >
              {stat.value}
            </div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
