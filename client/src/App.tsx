import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

import TopNavigation from "@/components/TopNavigation";
import BottomNavigation, { type NavItem } from "@/components/BottomNavigation";
import CreateQuoteModal from "@/components/CreateQuoteModal";

import LandingPage from "@/pages/LandingPage";
import FeedPage from "@/pages/FeedPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import StorePage from "@/pages/StorePage";
import ProfilePage from "@/pages/ProfilePage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import NotFound from "@/pages/not-found";

function Router() {
  const [location, setLocation] = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

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

  // Show landing page for unauthenticated users
  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen">
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route component={LandingPage} />
        </Switch>
      </div>
    );
  }

  // Show main app for authenticated users
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
