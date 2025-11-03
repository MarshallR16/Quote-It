import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import TopNavigation from "@/components/TopNavigation";
import BottomNavigation, { type NavItem } from "@/components/BottomNavigation";
import CreateQuoteModal from "@/components/CreateQuoteModal";

import FeedPage from "@/pages/FeedPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import StorePage from "@/pages/StorePage";
import ProfilePage from "@/pages/ProfilePage";
import AdminPage from "@/pages/AdminPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import NotFound from "@/pages/not-found";

function Router() {
  const [location, setLocation] = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLoginModalOpen(true);
    }
  }, [isLoading, isAuthenticated]);

  const handleNavigation = (item: NavItem) => {
    const routes: Record<NavItem, string> = {
      feed: "/",
      leaderboard: "/leaderboard",
      store: "/store",
      profile: "/profile",
    };
    setLocation(routes[item]);
  };

  const getCurrentNavItem = (): NavItem => {
    if (location === "/leaderboard") return "leaderboard";
    if (location === "/store") return "store";
    if (location === "/profile") return "profile";
    return "feed";
  };

  return (
    <div className="min-h-screen">
      <TopNavigation
        onCreateClick={() => setCreateModalOpen(true)}
        onProfileClick={() => setLocation("/profile")}
      />
      <main className="pt-16">
        <Switch>
          <Route path="/" component={FeedPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/store" component={StorePage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/checkout/:productId" component={CheckoutPage} />
          <Route path="/checkout/success" component={CheckoutSuccessPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNavigation
        activeItem={getCurrentNavItem()}
        onNavigate={handleNavigation}
      />
      <CreateQuoteModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-3xl font-display text-center">QUOTE-IT</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Log in to share quotes, vote, and shop exclusive merch
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-4">
            <Button
              size="lg"
              onClick={() => {
                window.location.href = "/api/login";
              }}
              className="w-full"
              data-testid="button-login-modal"
            >
              Log In / Sign Up
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
