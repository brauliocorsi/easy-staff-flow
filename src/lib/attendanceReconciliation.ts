/**
 * Conciliação mensal do ponto.
 *
 * Calcula, a partir dos registos de ponto + horários do funcionário, o diff
 * diário NEGATIVO acumulado num mês. Esse valor é depois proposto como
 * débito de conciliação no fecho mensal do banco de horas, evitando que
 * diferenças negativas do ponto fiquem invisíveis no saldo oficial.
 *
 * Regras:
 *  - Apenas diferenças NEGATIVAS confirmadas geram débito.
 *  - Positivos NUNCA são creditados automaticamente — devem passar por
 *    `overtime_approvals`.
 *  - O resultado é uma magnitude POSITIVA (minutos a debitar).
 */
import {
  calculateWorkday, resolveTolerances,
  type ScheduleLike, type TimeClockRecordLike, type Tolerances,
} from "./timeClock";

export type AttendanceDay = {
  record: TimeClockRecordLike | null;
  schedule: ScheduleLike | null;
  tolerances?: Partial<Tolerances> | null;
  /** Se true, o dia é ignorado (férias, ausência justificada, etc.). */
  skip?: boolean;
};

/**
 * Soma o diff NEGATIVO (sem sinal) de todos os dias do mês.
 * Dias positivos ou neutros contribuem com 0. Dias incompletos / sem horário /
 * dias com `skip = true` são ignorados.
 */
export function computeMonthlyNegativeDiff(days: AttendanceDay[]): number {
  let totalNegative = 0;
  for (const d of days) {
    if (d.skip) continue;
    if (!d.schedule || d.schedule.is_day_off) continue;
    if (!d.record) continue;
    const tol = resolveTolerances(d.tolerances ?? null);
    const { diff } = calculateWorkday(d.record, d.schedule, tol);
    if (diff < 0) totalNegative += Math.abs(diff);
  }
  return totalNegative;
}

/**
 * Calcula o valor de conciliação ainda em falta:
 * `total negativo do ponto − débitos de conciliação já lançados`.
 * Nunca devolve valor negativo.
 */
export function computePendingAttendanceDebit(
  totalNegativeMinutes: number,
  alreadyAdjustedMinutes: number,
): number {
  return Math.max(0, Math.round(totalNegativeMinutes) - Math.max(0, Math.round(alreadyAdjustedMinutes)));
}