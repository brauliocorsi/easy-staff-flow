import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface MeetingTimerProps {
  endTime: string | null | undefined;
  startedAt: string | null | undefined;
  status: string;
  className?: string;
  large?: boolean;
}

export function MeetingTimer({ endTime, startedAt, status, className, large }: MeetingTimerProps) {
  const [display, setDisplay] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (status === "completed") {
      setDisplay("Concluída");
      return;
    }

    if (status === "scheduled" || !startedAt) {
      setDisplay("Não iniciada");
      return;
    }

    // Meeting is in_progress – show elapsed time since started_at
    const update = () => {
      const elapsed = Date.now() - new Date(startedAt).getTime();
      if (endTime) {
        const remaining = new Date(endTime).getTime() - Date.now();
        if (remaining <= 0) {
          setIsExpired(true);
        } else {
          setIsExpired(false);
        }
      }
      const h = Math.floor(elapsed / 3600000);
      const m = Math.floor((elapsed % 3600000) / 60000);
      const s = Math.floor((elapsed % 60000) / 1000);
      setDisplay(
        `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endTime, startedAt, status]);

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Clock className={large ? "h-8 w-8" : "h-5 w-5"} />
      <span
        className={`font-mono font-bold tabular-nums ${
          large ? "text-5xl" : "text-2xl"
        } ${isExpired ? "text-destructive" : "text-foreground"}`}
      >
        {display}
      </span>
    </div>
  );
}
