import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-8xl md:text-9xl font-bold mb-6 font-display tracking-tight">
          QUOTE-IT
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-12">
          Share quotes. Vote. Wear the best.
        </p>
        <Button
          size="lg"
          onClick={handleLogin}
          className="text-lg px-8 h-14"
          data-testid="button-login"
        >
          Enter
        </Button>
      </div>
    </div>
  );
}
