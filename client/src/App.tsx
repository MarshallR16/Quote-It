import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@shared/schema";
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
import TermsAcceptanceModal from "@/components/TermsAcceptanceModal";
import ProfileCompletionModal from "@/components/ProfileCompletionModal";
import WinnerCelebrationModal from "@/components/WinnerCelebrationModal";
import { AuthRedirectHandler } from "@/components/AuthRedirectHandler";

import FeedPage from "@/pages/FeedPage";
import LeaderboardPage from "@/pages/LeaderboardPage";
import StorePage from "@/pages/StorePage";
import ProfilePage from "@/pages/ProfilePage";
import UserProfilePage from "@/pages/UserProfilePage";
import FriendsPage from "@/pages/FriendsPage";
import SearchPeoplePage from "@/pages/SearchPeoplePage";
import AdminPage from "@/pages/AdminPage";
import CheckoutPage from "@/pages/CheckoutPage";
import CheckoutSuccessPage from "@/pages/CheckoutSuccessPage";
import LoginPage from "@/pages/LoginPage";
import TermsPage from "@/pages/TermsPage";
import SupportPage from "@/pages/SupportPage";
import NotFound from "@/pages/not-found";

interface WinnerOrderData {
  order: {
    id: string;
    productId: string;
    status: string;
    isComplimentary: boolean;
  };
  quote: {
    id: string;
    text: string;
  };
  product: {
    id: string;
    name: string;
  };
  winner: {
    id: string;
    weekStartDate: string;
    weekEndDate: string;
    finalVoteCount: number;
  } | null;
}

function Router() {
  const [location, setLocation] = useLocation();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { isAuthenticated, isLoading, requiresProfileCompletion, firebaseUser, profileData } = useAuth();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    enabled: isAuthenticated,
  });

  // Check if user is a winner with pending order
  const { data: winnerOrderData } = useQuery<WinnerOrderData | null>({
    queryKey: ["/api/winner/pending-order"],
    enabled: isAuthenticated && !requiresProfileCompletion,
  });

  // Show winner modal if there's a pending order and user hasn't been notified
  useEffect(() => {
    if (winnerOrderData?.order?.id) {
      const notifiedKey = `winner_notified_${winnerOrderData.order.id}`;
      const alreadyNotified = localStorage.getItem(notifiedKey);
      if (!alreadyNotified) {
        setShowWinnerModal(true);
      }
    }
  }, [winnerOrderData]);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowTermsModal(false);
    } else if (isAuthenticated && currentUser && !currentUser.termsAccepted) {
      setShowTermsModal(true);
    } else if (currentUser?.termsAccepted) {
      setShowTermsModal(false);
    }
  }, [isAuthenticated, currentUser]);

  const handleNavigation = (item: NavItem) => {
    // Redirect to login if trying to access profile without authentication
    if (item === "profile" && !isAuthenticated) {
      setLocation("/login");
      return;
    }

    const routes: Record<NavItem, string> = {
      feed: "/",
      archive: "/archive",
      store: "/store",
      profile: "/profile",
    };
    setLocation(routes[item]);
  };

  const getCurrentNavItem = (): NavItem => {
    if (location === "/archive") return "archive";
    if (location === "/store") return "store";
    if (location === "/profile") return "profile";
    return "feed";
  };

  // Protected routes that require authentication
  const protectedRoutes = ['/profile', '/friends', '/admin', '/checkout'];
  const needsAuth = protectedRoutes.some(route => location.startsWith(route));

  // Redirect to login if trying to access protected route without auth
  if (needsAuth && !isAuthenticated && !isLoading) {
    return <LoginPage />;
  }

  // Show loading state only when needed
  if (isLoading && needsAuth) {
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
    <div className="min-h-screen overflow-x-hidden">
      <TopNavigation
        onCreateClick={() => {
          if (!isAuthenticated) {
            setLocation("/login");
          } else {
            setCreateModalOpen(true);
          }
        }}
        onProfileClick={() => {
          if (!isAuthenticated) {
            setLocation("/login");
          } else {
            setLocation("/profile");
          }
        }}
        onClaimFreeShirt={() => {
          setShowWinnerModal(true);
        }}
      />
      <main className="pt-16 mt-safe">
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/terms" component={TermsPage} />
          <Route path="/support" component={SupportPage} />
          <Route path="/" component={FeedPage} />
          <Route path="/archive" component={LeaderboardPage} />
          <Route path="/store" component={StorePage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/friends" component={FriendsPage} />
          <Route path="/search" component={SearchPeoplePage} />
          <Route path="/users/:userId" component={UserProfilePage} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/checkout/success" component={CheckoutSuccessPage} />
          <Route path="/checkout/:productId" component={CheckoutPage} />
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
      <TermsAcceptanceModal
        open={showTermsModal}
      />
      <ProfileCompletionModal
        open={requiresProfileCompletion}
        email={profileData?.email || firebaseUser?.email}
        profileImageUrl={profileData?.profileImageUrl || firebaseUser?.photoURL}
      />
      <WinnerCelebrationModal
        open={showWinnerModal && !!winnerOrderData}
        orderData={winnerOrderData || null}
        onComplete={() => {
          setShowWinnerModal(false);
          if (winnerOrderData?.order?.id) {
            localStorage.setItem(`winner_notified_${winnerOrderData.order.id}`, "true");
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthRedirectHandler />
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
