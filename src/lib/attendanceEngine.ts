/**
 * Motor único de avaliação diária do ponto (RH UP Móveis).
 *
 * Fachada: a implementação é partilhada com o servidor em
 * `supabase/functions/_shared/attendance/engine.ts`.
 */
export {
  ENGINE_VERSION,
  DEFAULT_EARLY_ENTRY_TOLERANCE,
  resolveEngineTolerances,
  evaluateDay,
  calculateWorkday,
  detectOvertimeCandidate,
  detectEarlyEntryCandidate,
  scheduleHasBreak,
  isOvernightSchedule,
} from "../../supabase/functions/_shared/attendance/engine";

export type {
  EngineTolerances,
  DayEvaluation,
  ReviewReason,
} from "../../supabase/functions/_shared/attendance/engine";
