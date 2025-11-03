import { Button } from "@/components/ui/button";
import { Home, Flame, ShoppingBag, User } from "lucide-react";
import { useState } from "react";

export type NavItem = "feed" | "leaderboard" | "store" | "profile";

interface BottomNavigationProps {
  activeItem?: NavItem;
  onNavigate?: (item: NavItem) => void;
}

export default function BottomNavigation({
  activeItem = "feed",
  onNavigate,
}: BottomNavigationProps) {
  const [active, setActive] = useState<NavItem>(activeItem);

  const handleNavigate = (item: NavItem) => {
    setActive(item);
    onNavigate?.(item);
    console.log(`Navigating to: ${item}`);
  };

  const navItems: { type: NavItem; label: string; icon: any }[] = [
    { type: "feed", label: "Feed", icon: Home },
    { type: "leaderboard", label: "Leaderboard", icon: Flame },
    { type: "store", label: "Store", icon: ShoppingBag },
    { type: "profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t bg-background z-20">
      <div className="h-full flex items-center justify-around">
        {navItems.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            variant="ghost"
            size="icon"
            className={`flex-col gap-1 h-full w-full rounded-none ${
              active === type ? "text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => handleNavigate(type)}
            data-testid={`button-nav-${type}`}
          >
            <Icon className={`w-5 h-5 ${active === type ? "fill-current" : ""}`} />
            <span className="text-xs">{label}</span>
          </Button>
        ))}
      </div>
    </nav>
  );
}
