import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Flame, Clock, TrendingUp, Users } from "lucide-react";
import WeeklyWinnerCountdown from "@/components/WeeklyWinnerCountdown";

export type FilterType = "recent" | "trending" | "top" | "friends";

interface FeedFiltersProps {
  activeFilter?: FilterType;
  onFilterChange?: (filter: FilterType) => void;
}

export default function FeedFilters({
  activeFilter = "recent",
  onFilterChange,
}: FeedFiltersProps) {
  const [active, setActive] = useState<FilterType>(activeFilter);

  const handleFilterClick = (filter: FilterType) => {
    setActive(filter);
    onFilterChange?.(filter);
    console.log(`Filter changed to: ${filter}`);
  };

  const filters: { type: FilterType; label: string; icon: any }[] = [
    { type: "top", label: "Ranking", icon: TrendingUp },
    { type: "friends", label: "Following", icon: Users },
    { type: "recent", label: "Rate It", icon: Clock },
  ];

  return (
    <div className="sticky top-16 bg-background z-10 border-b">
      <div className="px-4 py-2 lg:hidden flex justify-center">
        <WeeklyWinnerCountdown />
      </div>
      <div
        className="flex gap-2 px-4 py-3"
        data-testid="feed-filters"
      >
        {filters.map(({ type, label, icon: Icon }) => (
          <div key={type} className="relative flex-1">
            <Button
              variant={active === type ? "default" : "ghost"}
              size="sm"
              className="w-full rounded-full gap-1 transition-all"
              onClick={() => handleFilterClick(type)}
              data-testid={`button-filter-${type}`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{label}</span>
            </Button>
            {active === type && (
              <div className="absolute -bottom-3 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
