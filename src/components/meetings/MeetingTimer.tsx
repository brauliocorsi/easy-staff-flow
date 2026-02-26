import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface MeetingTimerProps {
  endTime: string | null | undefined;
  status: string;
  className?: string;
  large?: boolean;
}

export function MeetingTimer({ endTime, status, className, large }: MeetingTimerProps) {
  const [remaining, setRemaining] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!endTime || status === "completed") {
      setRemaining(status === "completed" ? "Concluída" : "--:--:--");
      return;
    }

    const update = () => {
      const diff = new Date(endTime).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("00:00:00");
        setIsExpired(true);
        return;
      }
      setIsExpired(false);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime, status]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Clock className={large ? "h-8 w-8" : "h-5 w-5"} />
      <span
        className={`font-mono font-bold tabular-nums ${
          large ? "text-5xl" : "text-2xl"
        } ${isExpired ? "text-destructive" : "text-foreground"}`}
      >
        {remaining}
      </span>
    </div>
  );
}
