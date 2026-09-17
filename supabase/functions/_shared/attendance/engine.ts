/**
 * MOTOR ÚNICO DE APURAMENTO DO PONTO — RH UP Móveis
 * =================================================
 *
 * Este ficheiro é a ÚNICA implementação das regras de ponto. É importado tal
 * e qual por:
 *   - a aplicação (via `src/lib/timeClock.ts` e `src/lib/attendanceEngine.ts`);
 *   - as edge functions (apuramento noturno, picagem, picagem automática).
 *
 * Não depende de Deno, de React nem de qualquer cliente de base de dados:
 * é código puro para poder correr nos dois lados sem duplicação.
 *
 * GRANDEZAS SEPARADAS (regra anti-dupla-compensação)
 * --------------------------------------------------
 *  1. `worked`                     — minutos efetivamente trabalhados
 *  2. `deficitMinutes`             — minutos em falta, SEMPRE brutos
 *  3. `overtimeCandidateMinutes`   — minutos depois do horário (candidato)
 *  4. `earlyEntryCandidateMinutes` — minutos antes do horário (candidato)
 *
 * Um crédito bruto nunca compensa um défice dentro do motor. Exemplo validado:
 * atraso 60 (tolerância 10) + saída 60 além do horário (tolerância 15) dá
 * défice 50 e candidato 45 — nunca +40.
 *
 * DIAS POR FECHAR
 * ---------------
 * Um dia sem o conjunto de picagens que o horário exige não gera défice nem
 * candidato: é marcado `needsReview`. Nunca se duplica nem se redistribui
 * silenciosamente uma picagem.
 */

export const TIME_ZONE = "Europe/Lisbon";
export const ENGINE_VERSION = "v2";

export type Tolerances = {
  tolerance_late_minutes: number;
  tolerance_overtime_minutes: number;
  tolerance_early_leave_minutes: number;
};

/**
 * Tolerâncias por regra de negócio:
 *  - 10 min de atraso à entrada (a favor do colaborador)
 *  - 15 min de saída além do horário (extra só conta a partir daí)
 *  - 0 min de saída antecipada (debitada ao primeiro minuto)
 */
export const DEFAULT_TOLERANCES: Tolerances = {
  tolerance_late_minutes: 10,
  tolerance_overtime_minutes: 15,
  tolerance_early_leave_minutes: 0,
};

export function resolveTolerances(t?: Partial<Tolerances> | null): Tolerances {
  return {
    tolerance_late_minutes: t?.tolerance_late_minutes ?? DEFAULT_TOLERANCES.tolerance_late_minutes,
    tolerance_overtime_minutes:
      t?.tolerance_overtime_minutes ?? DEFAULT_TOLERANCES.tolerance_overtime_minutes,
    // Regra de negócio: a saída antecipada não tem tolerância. Valor guardado é ignorado.
    tolerance_early_leave_minutes: 0,
  };
}

/**
 * Tolerância explícita e configurável da ENTRADA ANTECIPADA.
 *
 * Default 0: todos os minutos brutos antes do horário são mostrados como
 * candidato a aprovação. Nunca há crédito automático — apenas o responsável
 * decide. O valor é configurável por modelo de horário.
 */
export type EngineTolerances = Tolerances & {
  tolerance_early_entry_minutes: number;
};

export const DEFAULT_EARLY_ENTRY_TOLERANCE = 0;

export function resolveEngineTolerances(
  t?: Partial<EngineTolerances> | null,
): EngineTolerances {
  return {
    ...resolveTolerances(t),
    tolerance_early_entry_minutes: Math.max(
      0,
      t?.tolerance_early_entry_minutes ?? DEFAULT_EARLY_ENTRY_TOLERANCE,
    ),
  };
}

export type TimeClockRecordLike = {
  clock_in?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  clock_out?: string | null;
};

export type ScheduleLike = {
  clock_in_time: string;
  lunch_out_time: string;
  lunch_in_time: string;
  clock_out_time: string;
  is_day_off?: boolean;
};

export type DayStatus =
  | "day_off"
  | "vacation"
  | "no_record"
  | "half_day_morning"
  | "half_day_afternoon"
  | "incomplete"
  | "complete"
  | "punched_on_day_off";

type PunchField = "clock_in" | "lunch_out" | "lunch_in" | "clock_out";

const punchFields: PunchField[] = ["clock_in", "lunch_out", "lunch_in", "clock_out"];

// ---------------------------------------------------------------------------
// Primitivas de tempo (Europe/Lisbon, seguras com mudança de hora)
// ---------------------------------------------------------------------------

export function formatPunchTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function timestampToLisbonMinutes(ts: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ts));
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

/** Converte uma hora de parede de Lisboa num instante UTC (seguro com DST). */
export function lisbonTimeToUTC(dateStr: string, h: number, m: number): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, m, 0);
  const tzName =
    new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "shortOffset" })
      .formatToParts(new Date(naive))
      .find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = tzName.match(/GMT([+-]\d+(?::\d+)?)?/);
  let offsetMin = 0;
  if (match && match[1]) {
    const [oh, om] = match[1].split(":");
    const sign = oh.startsWith("-") ? -1 : 1;
    offsetMin = sign * (Math.abs(parseInt(oh, 10)) * 60 + (om ? parseInt(om, 10) : 0));
  }
  return new Date(naive - offsetMin * 60 * 1000);
}

export function minutesToHHMM(mins: number): string {
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function minutesToHoursLabel(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.round(Math.abs(mins) % 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function isPartTimeSchedule(schedule: ScheduleLike | null | undefined): boolean {
  if (!schedule || schedule.is_day_off) return false;
  return schedule.lunch_in_time === "00:00:00" && schedule.clock_out_time === "00:00:00";
}

/** Horário com pausa de almoço modelada (exige 4 picagens). */
export function scheduleHasBreak(schedule: ScheduleLike): boolean {
  if (isPartTimeSchedule(schedule)) return false;
  return timeToMinutes(schedule.lunch_in_time) > timeToMinutes(schedule.lunch_out_time);
}

/** Turno que atravessa a meia-noite: não está modelado — exige validação. */
export function isOvernightSchedule(schedule: ScheduleLike): boolean {
  if (!schedule || schedule.is_day_off) return false;
  const end = isPartTimeSchedule(schedule)
    ? timeToMinutes(schedule.lunch_out_time)
    : timeToMinutes(schedule.clock_out_time);
  return end <= timeToMinutes(schedule.clock_in_time);
}

export function hasAnyPunch(record: TimeClockRecordLike | null | undefined): boolean {
  return !!(record?.clock_in || record?.lunch_out || record?.lunch_in || record?.clock_out);
}

export function countPunches(record: TimeClockRecordLike | null | undefined): number {
  if (!record) return 0;
  return [record.clock_in, record.lunch_out, record.lunch_in, record.clock_out].filter(Boolean)
    .length;
}

export function scheduledWorkMinutes(schedule: ScheduleLike): number {
  if (schedule.is_day_off) return 0;
  if (isPartTimeSchedule(schedule)) {
    return Math.max(
      0,
      timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time),
    );
  }
  const morning = Math.max(
    0,
    timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time),
  );
  const afternoon = Math.max(
    0,
    timeToMinutes(schedule.clock_out_time) - timeToMinutes(schedule.lunch_in_time),
  );
  return morning + afternoon;
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length < size) return [];
  const [head, ...tail] = arr;
  return [
    ...combinations(tail, size - 1).map((combo) => [head, ...combo]),
    ...combinations(tail, size),
  ];
}

/**
 * Associa cada picagem existente ao campo do horário mais próximo.
 * NUNCA inventa nem duplica picagens: o número de campos preenchidos é sempre
 * igual ao número de picagens registadas.
 */
export function normalizeTimeRecord<T extends TimeClockRecordLike | null | undefined>(
  record: T,
  schedule: ScheduleLike | null | undefined,
): TimeClockRecordLike {
  return resolvePunches(record, schedule).record;
}

/**
 * Resolve as picagens registadas, indicando SEMPRE se a associação proposta
 * difere dos campos originais. Quando difere, os campos originais são
 * preservados e o dia é marcado para revisão humana — nunca se remapeia
 * silenciosamente uma picagem ambígua.
 */
export function resolvePunches<T extends TimeClockRecordLike | null | undefined>(
  record: T,
  schedule: ScheduleLike | null | undefined,
): { record: TimeClockRecordLike; remapped: boolean } {
  const proposed = proposePunches(record, schedule);
  const original: TimeClockRecordLike = {
    clock_in: record?.clock_in ?? null,
    lunch_out: record?.lunch_out ?? null,
    lunch_in: record?.lunch_in ?? null,
    clock_out: record?.clock_out ?? null,
  };
  const remapped = punchFields.some((f) => (proposed[f] ?? null) !== (original[f] ?? null));
  return { record: remapped ? original : proposed, remapped };
}

function proposePunches<T extends TimeClockRecordLike | null | undefined>(
  record: T,
  schedule: ScheduleLike | null | undefined,
): TimeClockRecordLike {
  const empty = { clock_in: null, lunch_out: null, lunch_in: null, clock_out: null };
  if (!record || !schedule || schedule.is_day_off) return { ...empty, ...(record || {}) };

  const punches = punchFields
    .map((field) => ({ field, ts: record[field] || null }))
    .filter((p): p is { field: PunchField; ts: string } => !!p.ts)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (punches.length === 0) return empty;

  if (isPartTimeSchedule(schedule)) {
    return punches.length === 1
      ? { ...empty, clock_in: punches[0].ts }
      : { ...empty, clock_in: punches[0].ts, lunch_out: punches[punches.length - 1].ts };
  }

  const expected = [
    { field: "clock_in" as PunchField, minutes: timeToMinutes(schedule.clock_in_time) },
    { field: "lunch_out" as PunchField, minutes: timeToMinutes(schedule.lunch_out_time) },
    { field: "lunch_in" as PunchField, minutes: timeToMinutes(schedule.lunch_in_time) },
    { field: "clock_out" as PunchField, minutes: timeToMinutes(schedule.clock_out_time) },
  ];

  const k = Math.min(punches.length, expected.length);
  let best = expected.slice(0, k);
  let bestScore = Number.POSITIVE_INFINITY;

  for (const combo of combinations(expected, k)) {
    const score = combo.reduce((sum, exp, index) => {
      const actual = timestampToLisbonMinutes(punches[index].ts);
      const fieldPenalty = punches[index].field === exp.field ? 0 : 2;
      return sum + Math.abs(actual - exp.minutes) + fieldPenalty;
    }, 0);
    if (score < bestScore) {
      bestScore = score;
      best = combo;
    }
  }

  const normalized: TimeClockRecordLike = { ...empty };
  best.forEach((exp, index) => {
    normalized[exp.field] = punches[index].ts;
  });
  return normalized;
}

// ---------------------------------------------------------------------------
// Avaliação diária
// ---------------------------------------------------------------------------

export type ReviewReason =
  | "missing_punch"
  | "missing_lunch_punches"
  | "part_time_single_punch"
  | "unpaired_lunch"
  | "overnight_shift"
  | "interval_anomaly"
  | "ambiguous_punches";

export type DayEvaluation = {
  scheduled: number;
  worked: number;
  /**
   * Minutos observados APENAS para leitura em relatórios (dias incompletos
   * incluídos). Nunca usado em saldos, défices ou candidatos.
   */
  observedWorked: number;
  punchCount: number;
  isDayOff: boolean;
  noRecord: boolean;
  incomplete: boolean;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  /** Défice BRUTO (magnitude positiva), nunca compensado por crédito. */
  deficitMinutes: number;
  deficitBreakdown: { late: number; earlyLeave: number; lunch: number };
  earlyEntryMinutes: number;
  overtimeAfterMinutes: number;
  overtimeCandidateMinutes: number;
  earlyEntryCandidateMinutes: number;
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
    observedWorked: 0,
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

export function evaluateDay(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike | null | undefined,
  tolerances?: Partial<EngineTolerances> | null,
): DayEvaluation {
  const tol = resolveEngineTolerances(tolerances);

  if (!schedule) {
    const any = hasAnyPunch(record);
    return emptyEvaluation(
      0,
      { clock_in: null, lunch_out: null, lunch_in: null, clock_out: null },
      {
        punchCount: countPunches(record),
        noRecord: !any,
        needsReview: any,
        reviewReasons: any ? ["missing_punch"] : [],
      },
    );
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
    // Ausência total: é matéria do módulo de faltas, nunca debitada aqui.
    return emptyEvaluation(scheduled, normalizeTimeRecord(null, schedule), { noRecord: true });
  }

  const resolved = resolvePunches(record, schedule);
  const normalized = resolved.record;
  const partTime = isPartTimeSchedule(schedule);

  // Picagens que não correspondem à sequência prevista: não são reinterpretadas.
  if (resolved.remapped) {
    return emptyEvaluation(scheduled, normalized, {
      punchCount,
      incomplete: true,
      needsReview: true,
      reviewReasons: ["ambiguous_punches"],
    });
  }

  // Turno noturno não está modelado: exige validação explícita.
  if (isOvernightSchedule(schedule)) {
    return emptyEvaluation(scheduled, normalized, {
      punchCount,
      incomplete: true,
      needsReview: true,
      reviewReasons: ["overnight_shift"],
    });
  }

  const schedIn = timeToMinutes(schedule.clock_in_time);
  const schedOut = partTime
    ? timeToMinutes(schedule.lunch_out_time)
    : timeToMinutes(schedule.clock_out_time);

  let incomplete = false;
  const reasons: ReviewReason[] = [];

  let inTs: string | null = normalized.clock_in ?? null;
  let outTs: string | null = null;

  if (partTime) {
    // Uma picagem só NUNCA é reutilizada como entrada e saída.
    const distinct = Array.from(
      new Set(
        [normalized.clock_in, normalized.lunch_out, normalized.clock_out].filter(
          Boolean,
        ) as string[],
      ),
    );
    if (distinct.length < 2) {
      incomplete = true;
      reasons.push("part_time_single_punch");
    } else {
      inTs = distinct[0];
      outTs = distinct[distinct.length - 1];
    }
  } else {
    outTs = normalized.clock_out ?? null;
    if (!inTs || !outTs) {
      incomplete = true;
      reasons.push("missing_punch");
    } else if (scheduleHasBreak(schedule)) {
      // Jornada COM pausa: entrada + saída sem picagens de almoço não é um dia
      // válido. Não se assume a pausa prevista — marca-se para revisão.
      if (!normalized.lunch_out && !normalized.lunch_in) {
        incomplete = true;
        reasons.push("missing_lunch_punches");
      } else if (!normalized.lunch_out || !normalized.lunch_in) {
        incomplete = true;
        reasons.push("unpaired_lunch");
      }
    }
  }

  const actualIn = inTs ? timestampToLisbonMinutes(inTs) : null;
  const actualOut = outTs ? timestampToLisbonMinutes(outTs) : null;

  const earlyEntryMinutes = actualIn !== null ? Math.max(0, schedIn - actualIn) : 0;
  const overtimeAfterMinutes = actualOut !== null ? Math.max(0, actualOut - schedOut) : 0;

  if (incomplete) {
    // Estimativa informativa (só para relatórios): intervalo entre a primeira e
    // a última picagem, descontando a pausa prevista quando não foi picada.
    let observedWorked = 0;
    if (actualIn !== null && actualOut !== null && actualOut > actualIn) {
      observedWorked = actualOut - actualIn;
      if (!partTime && scheduleHasBreak(schedule) && !(normalized.lunch_out && normalized.lunch_in)) {
        const schedLunch = Math.max(
          0,
          timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time),
        );
        observedWorked = Math.max(0, observedWorked - schedLunch);
      }
    }
    return emptyEvaluation(scheduled, normalized, {
      punchCount,
      observedWorked,
      incomplete: true,
      needsReview: true,
      reviewReasons: reasons,
      earlyEntryMinutes,
      overtimeAfterMinutes,
    });
  }

  const worked = computeWorked(normalized, inTs!, outTs!, partTime);

  // ---- Défice bruto --------------------------------------------------------
  const lateMinutes = Math.max(0, actualIn! - schedIn);
  const lateDeficit =
    lateMinutes > tol.tolerance_late_minutes ? lateMinutes - tol.tolerance_late_minutes : 0;
  const earlyLeaveDeficit = Math.max(0, schedOut - actualOut!);

  let lunchDeficit = 0;
  if (!partTime && normalized.lunch_out && normalized.lunch_in) {
    const schedLunchOut = timeToMinutes(schedule.lunch_out_time);
    const schedLunchIn = timeToMinutes(schedule.lunch_in_time);
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
  inTs: string,
  outTs: string,
  partTime: boolean,
): number {
  const span = Math.max(0, timestampToLisbonMinutes(outTs) - timestampToLisbonMinutes(inTs));
  if (partTime) return span;
  if (normalized.lunch_out && normalized.lunch_in) {
    const lunch = Math.max(
      0,
      timestampToLisbonMinutes(normalized.lunch_in) -
        timestampToLisbonMinutes(normalized.lunch_out),
    );
    return Math.max(0, span - lunch);
  }
  return span;
}

// ---------------------------------------------------------------------------
// Compatibilidade com os ecrãs existentes
// ---------------------------------------------------------------------------

export function calculateWorkedMinutes(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike,
): number {
  return evaluateDay(record, schedule).worked;
}

/**
 * Compatibilidade: `diff` informativo = candidato de saída tardia − défice bruto.
 * NÃO é o saldo do banco de horas: o saldo vem apenas de movimentos aprovados.
 */
export function calculateWorkday(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike,
  tolerances?: Partial<EngineTolerances> | null,
): {
  scheduled: number;
  worked: number;
  diff: number;
  incomplete: boolean;
  normalized: TimeClockRecordLike;
  evaluation: DayEvaluation;
} {
  const ev = evaluateDay(record, schedule, tolerances);
  return {
    scheduled: ev.scheduled,
    worked: ev.worked,
    diff: ev.overtimeCandidateMinutes - ev.deficitMinutes,
    incomplete: ev.incomplete,
    normalized: ev.normalized,
    evaluation: ev,
  };
}

/** Candidato de SAÍDA TARDIA. Nunca creditado — só proposto para aprovação. */
export function detectOvertimeCandidate(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike,
  tolerances?: Partial<EngineTolerances> | null,
): { minutes: number; toleranceApplied: number } | null {
  if (!record || schedule.is_day_off) return null;
  const tol = resolveEngineTolerances(tolerances);
  const ev = evaluateDay(record, schedule, tol);
  if (ev.needsReview || ev.overtimeCandidateMinutes <= 0) return null;
  return {
    minutes: ev.overtimeCandidateMinutes,
    toleranceApplied: tol.tolerance_overtime_minutes,
  };
}

/** Candidato de ENTRADA ANTECIPADA. Nunca creditado — só proposto para aprovação. */
export function detectEarlyEntryCandidate(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike,
  tolerances?: Partial<EngineTolerances> | null,
): { minutes: number; toleranceApplied: number } | null {
  if (!record || schedule.is_day_off) return null;
  const tol = resolveEngineTolerances(tolerances);
  const ev = evaluateDay(record, schedule, tol);
  if (ev.needsReview || ev.earlyEntryCandidateMinutes <= 0) return null;
  return {
    minutes: ev.earlyEntryCandidateMinutes,
    toleranceApplied: tol.tolerance_early_entry_minutes,
  };
}
