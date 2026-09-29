import { formatPunchTime } from "@/lib/timeClock";

export interface DayPunches {
  clock_in: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  clock_out: string | null;
}

interface Props {
  punches: DayPunches | null | undefined;
  isPartTime?: boolean;
  compact?: boolean;
}

/**
 * Lista as picagens reais do dia — sempre todas as que existem,
 * incluindo as feitas fora do horário de trabalho.
 */
export function TodayPunches({ punches, isPartTime, compact }: Props) {
  if (!punches) return null;

  const items: { label: string; value: string | null }[] = isPartTime
    ? [
        { label: "Entrada", value: punches.clock_in },
        { label: "Saída", value: punches.lunch_out || punches.clock_out },
      ]
    : [
        { label: "Entrada", value: punches.clock_in },
        { label: "Saída Almoço", value: punches.lunch_out },
        { label: "Retorno Almoço", value: punches.lunch_in },
        { label: "Saída", value: punches.clock_out },
      ];

  const done = items.filter((i) => i.value);
  if (done.length === 0) return null;

  return (
    <div className={compact ? "w-full" : "w-full rounded-md bg-muted/50 px-3 py-2"}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">
        Picagens de hoje
      </p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{item.label}</span>
            <span className={item.value ? "font-semibold text-foreground tabular-nums" : "text-muted-foreground/50"}>
              {item.value ? formatPunchTime(item.value) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
