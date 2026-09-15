/**
 * Motor único de avaliação diária do ponto (RH UP Móveis).
 *
 * Objetivo: separar de forma inequívoca quatro grandezas que antes viviam
 * misturadas num único `diff`:
 *
 *  1. `worked`                      — minutos efetivamente trabalhados;
 *  2. `deficitMinutes`              — minutos em falta (atraso além da tolerância,
 *                                      saída antecipada, anomalias de almoço);
 *  3. `overtimeCandidateMinutes`    — minutos após o horário, SEMPRE candidatos
 *                                      a aprovação, NUNCA creditados aqui;
 *  4. `earlyEntryCandidateMinutes`  — minutos antes do horário, SEMPRE candidatos
 *                                      a aprovação, NUNCA creditados aqui.
 *
 * REGRA ANTI-DUPLA-COMPENSAÇÃO
 * ----------------------------
 * O antigo `calculateWorkday().diff` compensava internamente crédito bruto com
 * défice (ex.: atraso 60 com tolerância 10 => -50; saída extra 60 com tolerância
 * 15 => +45; diff = -5). A conciliação mensal debitava apenas 5 e a aprovação
 * creditava 45 => +40 indevidos.
 *
 * Aqui o défice é SEMPRE bruto (50) e o crédito é SEMPRE um candidato separado
 * (45) que só entra no banco após aprovação. Resultado validado: 45 − 50 = −5.
 *
 * REGRA DE DIAS INCOMPLETOS
 * -------------------------
 * Um dia sem o par de picagens necessário não gera défice definitivo: é marcado
 * `incomplete` + `needsReview`. Nunca se duplica silenciosamente uma picagem
 * para a interpretar como entrada e saída (bug do part-time com uma picagem).
 */

import {
  hasAnyPunch,
  isPartTimeSchedule,
  normalizeTimeRecord,
  scheduledWorkMinutes,
  timeToMinutes,
  timestampToLisbonMinutes,
  type ScheduleLike,
  type TimeClockRecordLike,
  type Tolerances,
} from "./timeClock";

/**
 * Tolerâncias do motor. As três primeiras mantêm exatamente o comportamento
 * atual (atraso 10, saída extra 15, saída antecipada 0) para compatibilidade.
 *
 * `tolerance_early_entry_minutes` é um parâmetro NOVO e explícito: define
 * apenas o ruído abaixo do qual uma entrada antecipada não gera candidato.
 * Não representa qualquer decisão de pagamento — a entrada antecipada nunca é
 * creditada automaticamente.
 */
export type EngineTolerances = Tolerances & {
  tolerance_early_entry_minutes: number;
};

export const DEFAULT_EARLY_ENTRY_TOLERANCE = 15;

export function resolveEngineTolerances(
  t?: Partial<EngineTolerances> | null,
): EngineTolerances {
  return {
    tolerance_late_minutes: t?.tolerance_late_minutes ?? 10,
    tolerance_overtime_minutes: t?.tolerance_overtime_minutes ?? 15,
    // Regra de negócio: saída antecipada não tem tolerância.
    tolerance_early_leave_minutes: 0,
    tolerance_early_entry_minutes:
      t?.tolerance_early_entry_minutes ?? DEFAULT_EARLY_ENTRY_TOLERANCE,
  };
}

export type ReviewReason =
  | "missing_punch"
  | "part_time_single_punch"
  | "unpaired_lunch"
  | "interval_anomaly";

export type DayEvaluation = {
  /** Minutos previstos pelo horário (0 em folga). */
  scheduled: number;
  /** Minutos efetivamente trabalhados a partir das picagens existentes. */
  worked: number;
  /** Número de picagens registadas no dia. */
  punchCount: number;
  /** Dia de folga segundo o horário. */
  isDayOff: boolean;
  /** Nenhuma picagem no dia. */
  noRecord: boolean;
  /** Faltam picagens para fechar o dia. */
  incomplete: boolean;
  /** Requer validação humana antes de qualquer débito/crédito. */
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  /** Défice BRUTO em minutos (magnitude positiva), nunca compensado por crédito. */
  deficitMinutes: number;
  /** Detalhe do défice, para explicação no ecrã. */
  deficitBreakdown: {
    late: number;
    earlyLeave: number;
    lunch: number;
  };
  /** Minutos brutos antes do horário de entrada. */
  earlyEntryMinutes: number;
  /** Minutos brutos após o horário de saída. */
  overtimeAfterMinutes: number;
  /** Candidato a aprovação por saída tardia (após tolerância). */
  overtimeCandidateMinutes: number;
  /** Candidato a aprovação por entrada antecipada (após tolerância explícita). */
  earlyEntryCandidateMinutes: number;
  /** Picagens normalizadas usadas no cálculo. */
  normalized: TimeClockRecordLike;
};

function emptyEvaluation(
  scheduled: number,
  normalized: TimeClockRecordLike,
  patch: Partial<DayEvaluation> = {},
): DayEvaluation {
  return {
    scheduled,
    worked: 0,
    punchCount: 0,
    isDayOff: false,
    noRecord: false,
    incomplete: false,
    needsReview: false,
    reviewReasons: [],
    deficitMinutes: 0,
    deficitBreakdown: { late: 0, earlyLeave: 0, lunch: 0 },
    earlyEntryMinutes: 0,
    overtimeAfterMinutes: 0,
    overtimeCandidateMinutes: 0,
    earlyEntryCandidateMinutes: 0,
    normalized,
    ...patch,
  };
}

function countPunches(record: TimeClockRecordLike | null | undefined): number {
  if (!record) return 0;
  return [record.clock_in, record.lunch_out, record.lunch_in, record.clock_out].filter(Boolean)
    .length;
}

/**
 * Avalia um dia. Função pura — não escreve nada e não decide nada:
 * devolve grandezas separadas para que a conciliação (débitos) e a fila de
 * aprovações (créditos) trabalhem sobre números distintos.
 */
export function evaluateDay(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike | null | undefined,
  tolerances?: Partial<EngineTolerances> | null,
): DayEvaluation {
  const tol = resolveEngineTolerances(tolerances);

  if (!schedule) {
    return emptyEvaluation(0, { clock_in: null, lunch_out: null, lunch_in: null, clock_out: null }, {
      punchCount: countPunches(record),
      noRecord: !hasAnyPunch(record),
      needsReview: hasAnyPunch(record),
      reviewReasons: hasAnyPunch(record) ? ["missing_punch"] : [],
    });
  }

  const scheduled = scheduledWorkMinutes(schedule);
  const punchCount = countPunches(record);

  if (schedule.is_day_off) {
    return emptyEvaluation(0, normalizeTimeRecord(record, schedule), {
      isDayOff: true,
      punchCount,
      noRecord: punchCount === 0,
    });
  }

  if (punchCount === 0) {
    // Ausência total: tratada pelo módulo de faltas, nunca debitada aqui.
    return emptyEvaluation(scheduled, normalizeTimeRecord(null, schedule), { noRecord: true });
  }

  const normalized = normalizeTimeRecord(record, schedule);
  const partTime = isPartTimeSchedule(schedule);

  const schedIn = timeToMinutes(schedule.clock_in_time);
  const schedOut = partTime
    ? timeToMinutes(schedule.lunch_out_time)
    : timeToMinutes(schedule.clock_out_time);

  // ---- Determinar se o dia está completo -----------------------------------
  let incomplete = false;
  const reasons: ReviewReason[] = [];

  let inTs: string | null = normalized.clock_in ?? null;
  let outTs: string | null = null;

  if (partTime) {
    // NUNCA reutilizar a mesma picagem como entrada e saída.
    const distinct = [normalized.clock_in, normalized.lunch_out, normalized.clock_out].filter(
      Boolean,
    ) as string[];
    const unique = Array.from(new Set(distinct));
    if (unique.length < 2) {
      incomplete = true;
      reasons.push("part_time_single_punch");
    } else {
      inTs = unique[0];
      outTs = unique[unique.length - 1];
    }
  } else {
    outTs = normalized.clock_out ?? null;
    if (!inTs || !outTs) {
      incomplete = true;
      reasons.push("missing_punch");
    } else if (!!normalized.lunch_out !== !!normalized.lunch_in) {
      incomplete = true;
      reasons.push("unpaired_lunch");
    }
  }

  const worked = incomplete ? 0 : computeWorked(normalized, schedule, inTs!, outTs!, partTime);

  // ---- Grandezas brutas de entrada/saída -----------------------------------
  const actualIn = inTs ? timestampToLisbonMinutes(inTs) : null;
  const actualOut = outTs ? timestampToLisbonMinutes(outTs) : null;

  const earlyEntryMinutes = actualIn !== null ? Math.max(0, schedIn - actualIn) : 0;
  const overtimeAfterMinutes = actualOut !== null ? Math.max(0, actualOut - schedOut) : 0;

  if (incomplete) {
    // Dia por fechar: sinaliza, mas não debita nem gera candidatos.
    return emptyEvaluation(scheduled, normalized, {
      punchCount,
      worked: 0,
      incomplete: true,
      needsReview: true,
      reviewReasons: reasons,
      earlyEntryMinutes,
      overtimeAfterMinutes,
    });
  }

  // ---- Défice bruto (nunca compensado por crédito) -------------------------
  const lateMinutes = Math.max(0, actualIn! - schedIn);
  const lateDeficit =
    lateMinutes > tol.tolerance_late_minutes ? lateMinutes - tol.tolerance_late_minutes : 0;
  const earlyLeaveDeficit = Math.max(0, schedOut - actualOut!);

  let lunchDeficit = 0;
  if (!partTime && normalized.lunch_out && normalized.lunch_in) {
    const schedLunchOut = timeToMinutes(schedule.lunch_out_time);
    const schedLunchIn = timeToMinutes(schedule.lunch_in_time);
    // Sair mais cedo para almoço: sem tolerância.
    lunchDeficit += Math.max(0, schedLunchOut - timestampToLisbonMinutes(normalized.lunch_out));
    const returnLate = Math.max(0, timestampToLisbonMinutes(normalized.lunch_in) - schedLunchIn);
    if (returnLate > tol.tolerance_late_minutes) {
      lunchDeficit += returnLate - tol.tolerance_late_minutes;
    }
  }

  // ---- Candidatos (nunca creditados automaticamente) -----------------------
  const overtimeCandidateMinutes =
    overtimeAfterMinutes > tol.tolerance_overtime_minutes
      ? overtimeAfterMinutes - tol.tolerance_overtime_minutes
      : 0;
  const earlyEntryCandidateMinutes =
    earlyEntryMinutes > tol.tolerance_early_entry_minutes
      ? earlyEntryMinutes - tol.tolerance_early_entry_minutes
      : 0;

  return {
    scheduled,
    worked,
    punchCount,
    isDayOff: false,
    noRecord: false,
    incomplete: false,
    needsReview: false,
    reviewReasons: [],
    deficitMinutes: lateDeficit + earlyLeaveDeficit + lunchDeficit,
    deficitBreakdown: { late: lateDeficit, earlyLeave: earlyLeaveDeficit, lunch: lunchDeficit },
    earlyEntryMinutes,
    overtimeAfterMinutes,
    overtimeCandidateMinutes,
    earlyEntryCandidateMinutes,
    normalized,
  };
}

function computeWorked(
  normalized: TimeClockRecordLike,
  schedule: ScheduleLike,
  inTs: string,
  outTs: string,
  partTime: boolean,
): number {
  const span = Math.max(
    0,
    timestampToLisbonMinutes(outTs) - timestampToLisbonMinutes(inTs),
  );
  if (partTime) return span;
  if (normalized.lunch_out && normalized.lunch_in) {
    const lunch = Math.max(
      0,
      timestampToLisbonMinutes(normalized.lunch_in) -
        timestampToLisbonMinutes(normalized.lunch_out),
    );
    return Math.max(0, span - lunch);
  }
  const scheduledLunch = Math.max(
    0,
    timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time),
  );
  return Math.max(0, span - scheduledLunch);
}
