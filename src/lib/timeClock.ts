/**
 * Fachada do motor de ponto para a aplicação.
 *
 * A implementação real vive em `supabase/functions/_shared/attendance/engine.ts`
 * e é a MESMA que corre no servidor (apuramento noturno, picagem e picagem
 * automática). Este ficheiro apenas reexporta, para que não existam duas
 * versões das regras.
 */
export {
  TIME_ZONE,
  ENGINE_VERSION,
  DEFAULT_TOLERANCES,
  DEFAULT_EARLY_ENTRY_TOLERANCE,
  resolveTolerances,
  resolveEngineTolerances,
  formatPunchTime,
  timeToMinutes,
  timestampToLisbonMinutes,
  lisbonTimeToUTC,
  minutesToHHMM,
  minutesToHoursLabel,
  isPartTimeSchedule,
  scheduleHasBreak,
  isOvernightSchedule,
  hasAnyPunch,
  countPunches,
  scheduledWorkMinutes,
  normalizeTimeRecord,
  resolvePunches,
  evaluateDay,
  calculateWorkedMinutes,
  calculateWorkday,
  detectOvertimeCandidate,
  detectEarlyEntryCandidate,
} from "../../supabase/functions/_shared/attendance/engine";

export type {
  Tolerances,
  EngineTolerances,
  TimeClockRecordLike,
  ScheduleLike,
  DayStatus,
  DayEvaluation,
  ReviewReason,
} from "../../supabase/functions/_shared/attendance/engine";
