import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

interface WinnerCardProps {
  weekNumber: number;
  content: string;
  author: string;
  votes: number;
  onShopClick?: () => void;
}

export default function WinnerCard({
  weekNumber,
  content,
  author,
  votes,
  onShopClick,
}: WinnerCardProps) {
  return (
    <Card className="p-8 md:p-12" data-testid={`card-winner-${weekNumber}`}>
      <div className="flex items-center gap-2 mb-6">
        <Trophy className="w-5 h-5" />
        <Badge variant="default" className="text-xs">
          Winner - Week #{weekNumber}
        </Badge>
      </div>
      <blockquote className="text-3xl md:text-4xl font-bold leading-tight mb-6">
        "{content}"
      </blockquote>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm font-medium mb-1" data-testid="text-winner-author">
            {author}
          </p>
          <p className="text-xs text-muted-foreground" data-testid="text-winner-votes">
            {votes} votes
          </p>
        </div>
        <Button
          className="rounded-full"
          onClick={() => {
            onShopClick?.();
            console.log('Shop This Design clicked');
          }}
          data-testid="button-shop-design"
        >
          Shop This Design
        </Button>
      </div>
    </Card>
  );
}
