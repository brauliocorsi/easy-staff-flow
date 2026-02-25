import { useEffect, useState } from "react";

export function ClockDisplay() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const dateStr = time.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="text-center space-y-1">
      <div className="font-display text-6xl font-bold tracking-tight text-foreground tabular-nums">
        {timeStr}
      </div>
      <p className="text-muted-foreground text-lg capitalize">{dateStr}</p>
    </div>
  );
}
