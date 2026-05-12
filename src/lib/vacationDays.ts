export interface HolidayLike {
  holiday_date: string;
  recurring_yearly?: boolean;
}

/**
 * Conta dias úteis entre duas datas (inclusive), excluindo sábados, domingos
 * e feriados (incluindo feriados anuais recorrentes — match por MM-DD).
 *
 * Opcionalmente aceita `workingDaysOfWeek` (Set<number> com dias da semana
 * trabalhados, 0=Domingo..6=Sábado). Por defeito {1,2,3,4,5} (Seg–Sex).
 * Útil para calcular férias da fábrica/armazém com base no horário real.
 */
export function calcWorkingDays(
  start: string,
  end: string,
  holidays: HolidayLike[] = [],
  workingDaysOfWeek?: Set<number> | number[]
): number {
  if (!start || !end) return 0;
  const s = new Date(start + (start.length === 10 ? "T00:00:00" : ""));
  const e = new Date(end + (end.length === 10 ? "T00:00:00" : ""));
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;

  const workSet =
    workingDaysOfWeek instanceof Set
      ? workingDaysOfWeek
      : Array.isArray(workingDaysOfWeek)
      ? new Set<number>(workingDaysOfWeek)
      : new Set<number>([1, 2, 3, 4, 5]);

  const fixedSet = new Set<string>();
  const recurringSet = new Set<string>();
  for (const h of holidays) {
    if (!h?.holiday_date) continue;
    fixedSet.add(h.holiday_date);
    if (h.recurring_yearly) recurringSet.add(h.holiday_date.slice(5));
  }

  let count = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getDay();
    if (workSet.has(dow)) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const iso = `${yyyy}-${mm}-${dd}`;
      const mmdd = `${mm}-${dd}`;
      if (!fixedSet.has(iso) && !recurringSet.has(mmdd)) count++;
    }
    d.setDate(d.getDate() + 1);
  }
  return count;
}