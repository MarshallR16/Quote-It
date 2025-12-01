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
      
      // Find next Sunday at 11:59:59 PM UTC (when winner is selected)
      const nextSundayEnd = new Date(now);
      nextSundayEnd.setUTCHours(23, 59, 59, 999);
      
      // Get current day of week (0 = Sunday, 1 = Monday, etc.)
      const currentDay = now.getUTCDay();
      
      if (currentDay === 0) {
        // It's Sunday - check if we're past 23:59:59
        if (now.getUTCHours() === 23 && now.getUTCMinutes() >= 59) {
          // Past the deadline, count to next Sunday
          nextSundayEnd.setUTCDate(nextSundayEnd.getUTCDate() + 7);
        }
        // Otherwise, it's still Sunday before the deadline - no date change needed
      } else {
        // Not Sunday - calculate days until Sunday
        const daysUntilSunday = 7 - currentDay;
        nextSundayEnd.setUTCDate(nextSundayEnd.getUTCDate() + daysUntilSunday);
      }

      const diff = nextSundayEnd.getTime() - now.getTime();

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
