import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface UserStatsProps {
  username: string;
  joinDate: string;
  postsCount: number;
  totalVotes: number;
  wins: number;
  profileImageUrl?: string | null;
}

export default function UserStats({
  username,
  joinDate,
  postsCount,
  totalVotes,
  wins,
  profileImageUrl,
}: UserStatsProps) {
  const stats = [
    { label: "Posts", value: postsCount },
    { label: "Total Votes", value: totalVotes },
    { label: "Wins", value: wins },
  ];

  return (
    <Card className="p-6" data-testid="card-user-stats">
      <div className="mb-6 flex flex-col items-center text-center">
        <Avatar className="w-24 h-24 mb-4" data-testid="avatar-profile">
          <AvatarImage src={profileImageUrl || undefined} alt={username} />
          <AvatarFallback>
            <User className="w-12 h-12" />
          </AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-bold mb-1" data-testid="text-username">
          {username}
        </h2>
        <p className="text-xs text-muted-foreground" data-testid="text-join-date">
          Joined {joinDate}
        </p>
      </div>
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
