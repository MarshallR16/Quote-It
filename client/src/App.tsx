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
import UserProfilePage from "@/pages/UserProfilePage";
import FriendsPage from "@/pages/FriendsPage";
import AdminPage from "@/pages/AdminPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import LoginPage from "@/pages/LoginPage";
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

  // Show login page if not authenticated
  if (!isLoading && !isAuthenticated && location !== "/login") {
    return <LoginPage />;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold font-display tracking-tight mb-4">"IT"</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopNavigation
        onCreateClick={() => setCreateModalOpen(true)}
        onProfileClick={() => setLocation("/profile")}
      />
      <main className="pt-16">
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/" component={FeedPage} />
          <Route path="/leaderboard" component={LeaderboardPage} />
          <Route path="/store" component={StorePage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/friends" component={FriendsPage} />
          <Route path="/users/:userId" component={UserProfilePage} />
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
