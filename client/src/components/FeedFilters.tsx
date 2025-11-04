import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Flame, Clock, TrendingUp, Users } from "lucide-react";

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
    <div
      className="flex gap-2 border-b sticky top-16 bg-background z-10 px-4 py-2"
      data-testid="feed-filters"
    >
      {filters.map(({ type, label, icon: Icon }) => (
        <Button
          key={type}
          variant={active === type ? "default" : "ghost"}
          size="sm"
          className="rounded-full gap-1"
          onClick={() => handleFilterClick(type)}
          data-testid={`button-filter-${type}`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
