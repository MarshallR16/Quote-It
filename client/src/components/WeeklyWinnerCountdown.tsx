import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function WeeklyWinnerCountdown() {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // Find next Sunday at midnight UTC
      const nextSunday = new Date(now);
      nextSunday.setUTCHours(0, 0, 0, 0);
      
      // Get days until next Sunday (0 = Sunday, 1 = Monday, etc.)
      const daysUntilSunday = (7 - now.getUTCDay()) % 7;
      
      // If it's Sunday and past midnight, add 7 days
      // Otherwise add the days until next Sunday
      if (daysUntilSunday === 0 && now.getUTCHours() >= 0) {
        nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
      } else {
        nextSunday.setUTCDate(nextSunday.getUTCDate() + daysUntilSunday);
      }

      const diff = nextSunday.getTime() - now.getTime();

      if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 };
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      return { days, hours, minutes, seconds };
    };

    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!timeLeft) return null;

  return (
    <div 
      className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full text-sm"
      data-testid="weekly-winner-countdown"
    >
      <Clock className="w-4 h-4" />
      <span className="font-medium">Next print:</span>
      <span className="font-mono">
        {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
      </span>
    </div>
  );
}
