import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface MeetingTimerProps {
  durationMinutes: number | null | undefined;
  startedAt: string | null | undefined;
  pausedAt: string | null | undefined;
  pausedSeconds: number;
  status: string;
  className?: string;
  large?: boolean;
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MeetingTimer({ durationMinutes, startedAt, pausedAt, pausedSeconds, status, className, large }: MeetingTimerProps) {
  const [display, setDisplay] = useState("");
  const [isWarning, setIsWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (status === "completed") {
      setDisplay("Concluída");
      setIsWarning(false);
      setIsExpired(false);
      return;
    }

    if (status === "scheduled" || !startedAt) {
      // Show total duration as preview
      if (durationMinutes) {
        setDisplay(formatTime(durationMinutes * 60 * 1000));
      } else {
        setDisplay("Não iniciada");
      }
      setIsWarning(false);
      setIsExpired(false);
      return;
    }

    if (!durationMinutes) {
      setDisplay("Sem limite");
      setIsWarning(false);
      return;
    }

    const totalMs = durationMinutes * 60 * 1000;

    const update = () => {
      // Calculate active elapsed time (excluding pauses)
      const startMs = new Date(startedAt).getTime();
      const totalPausedMs = (pausedSeconds ?? 0) * 1000;

      let elapsedActive: number;
      if (pausedAt) {
        // Currently paused: elapsed = time from start to pause moment, minus previous pauses
        elapsedActive = new Date(pausedAt).getTime() - startMs - totalPausedMs;
      } else {
        // Running: elapsed = time from start to now, minus all pauses
        elapsedActive = Date.now() - startMs - totalPausedMs;
      }

      const remaining = totalMs - elapsedActive;

      if (remaining <= 0) {
        setDisplay("00:00:00");
        setIsWarning(true);
        setIsExpired(true);
        return;
      }

      setIsExpired(false);
      setIsWarning(remaining <= 5 * 60 * 1000);
      setDisplay(formatTime(remaining));
    };

    update();
    const interval = setInterval(update, pausedAt ? 5000 : 1000);
    return () => clearInterval(interval);
  }, [durationMinutes, startedAt, pausedAt, pausedSeconds, status]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Clock className={large ? "h-8 w-8" : "h-5 w-5"} />
      <span
        className={`font-mono font-bold tabular-nums ${
          large ? "text-5xl" : "text-2xl"
        } ${isWarning ? "text-destructive" : "text-foreground"} ${isWarning && !isExpired ? "animate-pulse" : ""}`}
      >
        {display}
      </span>
    </div>
  );
}
