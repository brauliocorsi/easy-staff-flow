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
import { evaluateDay, type EngineTolerances } from "./attendanceEngine";
import type { ScheduleLike, TimeClockRecordLike } from "./timeClock";

export type AttendanceDay = {
  record: TimeClockRecordLike | null;
  schedule: ScheduleLike | null;
  tolerances?: Partial<EngineTolerances> | null;
  /** Se true, o dia é ignorado (férias, feriado, ausência justificada, etc.). */
  skip?: boolean;
  /** Identificação do dia (yyyy-mm-dd), usada no resumo de ocorrências. */
  date?: string;
  /**
   * Minutos já compensados neste dia por utilização explícita de banco de horas
   * ou por outro movimento que referencia a ocorrência. Nunca voltam a ser
   * debitados pela conciliação.
   */
  compensatedMinutes?: number;
};

export type AttendanceSummary = {
  /** Défice BRUTO confirmado (dias completos), já líquido de minutos compensados. */
  debitMinutes: number;
  /** Dias que exigem validação humana antes de qualquer débito. */
  reviewDates: string[];
  /** Minutos candidatos a crédito (saída tardia) — nunca entram no débito. */
  overtimeCandidateMinutes: number;
  /** Minutos candidatos a crédito (entrada antecipada) — nunca entram no débito. */
  earlyEntryCandidateMinutes: number;
};

/**
 * Resumo mensal do ponto, com as grandezas separadas.
 *
 * O débito de conciliação usa o défice BRUTO — nunca o diff compensado —
 * para que a aprovação de horas extra não gere crédito em duplicado.
 * Dias incompletos são sinalizados para revisão e NÃO produzem débito.
 */
export function computeMonthlyAttendance(days: AttendanceDay[]): AttendanceSummary {
  let debitMinutes = 0;
  let overtimeCandidateMinutes = 0;
  let earlyEntryCandidateMinutes = 0;
  const reviewDates: string[] = [];

  days.forEach((d, i) => {
    if (d.skip) return;
    if (!d.schedule || d.schedule.is_day_off) return;
    if (!d.record) return;

    const ev = evaluateDay(d.record, d.schedule, d.tolerances ?? null);
    if (ev.noRecord) return;

    if (ev.needsReview) {
      reviewDates.push(d.date ?? String(i));
      return;
    }

    const compensated = Math.max(0, Math.round(d.compensatedMinutes ?? 0));
    debitMinutes += Math.max(0, ev.deficitMinutes - compensated);
    overtimeCandidateMinutes += ev.overtimeCandidateMinutes;
    earlyEntryCandidateMinutes += ev.earlyEntryCandidateMinutes;
  });

  return { debitMinutes, reviewDates, overtimeCandidateMinutes, earlyEntryCandidateMinutes };
}

/**
 * Compatibilidade: total de minutos em falta no mês (magnitude positiva).
 * Delegado em `computeMonthlyAttendance`.
 */
export function computeMonthlyNegativeDiff(days: AttendanceDay[]): number {
  return computeMonthlyAttendance(days).debitMinutes;
}

/**
 * Calcula o valor de conciliação ainda em falta:
 * `total em falta − débitos de conciliação já lançados`.
 * Nunca devolve valor negativo.
 */
export function computePendingAttendanceDebit(
  totalNegativeMinutes: number,
  alreadyAdjustedMinutes: number,
): number {
  return Math.max(0, Math.round(totalNegativeMinutes) - Math.max(0, Math.round(alreadyAdjustedMinutes)));
}