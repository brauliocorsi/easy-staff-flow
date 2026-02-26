import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface MeetingTimerProps {
  endTime: string | null | undefined;
  startedAt: string | null | undefined;
  pausedAt: string | null | undefined;
  pausedSeconds: number;
  status: string;
  className?: string;
  large?: boolean;
}

export function MeetingTimer({ endTime, startedAt, pausedAt, pausedSeconds, status, className, large }: MeetingTimerProps) {
  const [display, setDisplay] = useState("");
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    if (status === "completed") {
      setDisplay("Concluída");
      return;
    }

    if (status === "scheduled" || !startedAt) {
      setDisplay("Não iniciada");
      return;
    }

    if (!endTime) {
      setDisplay("Sem limite");
      return;
    }

    const update = () => {
      // Total paused time = saved seconds + current pause duration (if paused now)
      let totalPausedMs = (pausedSeconds ?? 0) * 1000;
      if (pausedAt) {
        totalPausedMs += Date.now() - new Date(pausedAt).getTime();
      }

      const remaining = new Date(endTime).getTime() + totalPausedMs - Date.now();

      if (remaining <= 0) {
        setDisplay("00:00:00");
        setIsWarning(true);
        return;
      }
      setIsWarning(remaining <= 5 * 60 * 1000);
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setDisplay(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };

    update();
    // If paused, update less frequently (display is static-ish)
    const interval = setInterval(update, pausedAt ? 5000 : 1000);
    return () => clearInterval(interval);
  }, [endTime, startedAt, pausedAt, pausedSeconds, status]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Clock className={large ? "h-8 w-8" : "h-5 w-5"} />
      <span
        className={`font-mono font-bold tabular-nums ${
          large ? "text-5xl" : "text-2xl"
        } ${isWarning ? "text-destructive animate-pulse" : "text-foreground"}`}
      >
        {display}
      </span>
    </div>
  );
}
