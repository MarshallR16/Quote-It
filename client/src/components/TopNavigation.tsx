import { Button } from "@/components/ui/button";
import { Plus, User, Moon, Sun, LogOut, ShoppingBag, Flame, Users, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import WeeklyWinnerCountdown from "@/components/WeeklyWinnerCountdown";

interface TopNavigationProps {
  onCreateClick?: () => void;
  onProfileClick?: () => void;
}

export default function TopNavigation({
  onCreateClick,
  onProfileClick,
}: TopNavigationProps) {
  const [darkMode, setDarkMode] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle("dark");
    console.log(`Dark mode ${!darkMode ? "enabled" : "disabled"}`);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed out",
        description: "You've been successfully signed out",
      });
      setLocation("/login");
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to sign out",
      });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 border-b bg-background z-20">
      <div className="h-full px-4 flex items-center justify-between max-w-7xl mx-auto gap-4">
        <h1 className="text-6xl font-bold font-display tracking-tight cursor-pointer" data-testid="text-logo" onClick={() => setLocation("/")}>
          "IT"
        </h1>
        <div className="hidden lg:block">
          <WeeklyWinnerCountdown />
        </div>
        <nav className="hidden md:flex items-center gap-2">
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="default"
              className="gap-2"
              onClick={() => setLocation("/friends")}
              data-testid="button-nav-friends"
            >
              <Users className="w-4 h-4" />
              <span>Friends</span>
            </Button>
          )}
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
          {isAuthenticated && user?.isAdmin && (
            <Button
              variant="ghost"
              size="default"
              className="gap-2"
              onClick={() => setLocation("/admin")}
              data-testid="button-nav-admin"
            >
              <Shield className="w-4 h-4" />
              <span>Admin</span>
            </Button>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
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
            </>
          ) : (
            <>
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
                variant="default"
                size="default"
                className="rounded-full"
                onClick={() => setLocation("/login")}
                data-testid="button-sign-in"
              >
                Sign In
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
