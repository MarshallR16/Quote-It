import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Quote, TrendingUp, Trophy, ShoppingBag } from "lucide-react";
import heroImage from "@assets/generated_images/Hero_lifestyle_t-shirt_photo_a1c8cecb.png";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        <img
          src={heroImage}
          alt="Quote-It community sharing quotes"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30" />
        <div className="absolute inset-0 flex items-center justify-center text-center px-4">
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-6xl md:text-8xl font-bold text-white mb-4 font-display tracking-tight">
                QUOTE-IT
              </h1>
              <div className="flex items-center justify-center gap-2 text-white/90 text-lg md:text-xl">
                <span>Share</span>
                <span className="text-white">•</span>
                <span>Vote</span>
                <span className="text-white">•</span>
                <span>Wear</span>
              </div>
            </div>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
              A minimalist community for sharing powerful quotes. The best get immortalized on T-shirts.
            </p>
            <Button
              size="lg"
              onClick={handleLogin}
              className="rounded-full bg-white text-black hover:bg-white/90 text-lg px-8 h-14"
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 px-4 bg-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 font-display">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="p-6 text-center">
              <Quote className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Share Quotes</h3>
              <p className="text-muted-foreground">
                Post your favorite quotes and discover wisdom from the community
              </p>
            </Card>

            <Card className="p-6 text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Vote & Rank</h3>
              <p className="text-muted-foreground">
                Upvote quotes you love. The best rise to the top each week
              </p>
            </Card>

            <Card className="p-6 text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Weekly Winners</h3>
              <p className="text-muted-foreground">
                The top quote each week gets featured on the leaderboard
              </p>
            </Card>

            <Card className="p-6 text-center">
              <ShoppingBag className="w-12 h-12 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Exclusive Merch</h3>
              <p className="text-muted-foreground">
                ONE winning quote becomes a limited edition T-shirt weekly
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 font-display">
            Ready to Share Your Wisdom?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join the community and start sharing quotes today
          </p>
          <Button
            size="lg"
            onClick={handleLogin}
            className="rounded-full text-lg px-8 h-14"
            data-testid="button-login-cta"
          >
            Log In to Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
