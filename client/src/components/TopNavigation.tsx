import { Button } from "@/components/ui/button";
import { Plus, User, Moon, Sun, LogOut, ShoppingBag, Flame } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface TopNavigationProps {
  onCreateClick?: () => void;
  onProfileClick?: () => void;
}

export default function TopNavigation({
  onCreateClick,
  onProfileClick,
}: TopNavigationProps) {
  const [darkMode, setDarkMode] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
    console.log(`Dark mode ${!darkMode ? "enabled" : "disabled"}`);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background z-20">
      <div className="h-full px-4 flex items-center justify-between max-w-7xl mx-auto">
        <h1 className="text-6xl font-bold font-display tracking-tight cursor-pointer" data-testid="text-logo" onClick={() => setLocation("/")}>
          IT
        </h1>
        <nav className="hidden md:flex items-center gap-2">
          <Button
            variant="ghost"
            size="default"
            className="gap-2"
            onClick={() => setLocation("/leaderboard")}
            data-testid="button-nav-leaderboard"
          >
            <Flame className="w-4 h-4" />
            <span>Leaderboard</span>
          </Button>
          <Button
            variant="ghost"
            size="default"
            className="gap-2"
            onClick={() => setLocation("/store")}
            data-testid="button-nav-store"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Store</span>
          </Button>
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="default"
            className="rounded-full gap-2"
            onClick={() => {
              onCreateClick?.();
              console.log('Create Quote clicked');
            }}
            data-testid="button-create-quote"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={toggleDarkMode}
            data-testid="button-theme-toggle"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              onProfileClick?.();
              console.log('Profile clicked');
            }}
            data-testid="button-profile"
          >
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.email || "User"}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <User className="w-5 h-5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="rounded-full"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
