const TIME_ZONE = "Europe/Lisbon";

export type Tolerances = {
  tolerance_late_minutes: number;
  tolerance_overtime_minutes: number;
  tolerance_early_leave_minutes: number;
};

/**
 * Default tolerances per business rule:
 * - 10 min late entry (in favour of employee)
 * - 15 min overtime (in favour of employer — extra only counts after 15 min)
 * - 0 min early leave (always against the employee; debited from the 1st minute)
 *
 * The `tolerance_early_leave_minutes` field is kept for backwards compatibility
 * with stored templates, but it is IGNORED by the calculation engine.
 */
export const DEFAULT_TOLERANCES: Tolerances = {
  tolerance_late_minutes: 10,
  tolerance_overtime_minutes: 15,
  tolerance_early_leave_minutes: 0,
};

/** Returns tolerances ensuring sensible defaults whenever the template values are missing/zero. */
export function resolveTolerances(t?: Partial<Tolerances> | null): Tolerances {
  return {
    tolerance_late_minutes: t?.tolerance_late_minutes ?? DEFAULT_TOLERANCES.tolerance_late_minutes,
    tolerance_overtime_minutes: t?.tolerance_overtime_minutes ?? DEFAULT_TOLERANCES.tolerance_overtime_minutes,
    // Early-leave tolerance is permanently 0 by business rule. Stored values are ignored.
    tolerance_early_leave_minutes: 0,
  };
}

export type DayStatus =
  | "day_off"
  | "vacation"
  | "no_record"
  | "half_day_morning"
  | "half_day_afternoon"
  | "incomplete"
  | "complete"
  | "punched_on_day_off";

/**
 * Detects if a punch slot was skipped given the current time and the schedule.
 * Used by the terminal to suggest auto-filling a missed punch.
 * Returns the missed slot + suggested time (HH:mm) or null if nothing is missing.
 */
export function detectMissingPunch(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike | null | undefined,
  nowMinutes: number
): { missing_slot: PunchField; suggested_time: string; next_action: PunchField } | null {
  if (!schedule || schedule.is_day_off || isPartTimeSchedule(schedule)) return null;
  const scheduleSlots: { field: PunchField; minutes: number }[] = [
    { field: "clock_in", minutes: timeToMinutes(schedule.clock_in_time) },
    { field: "lunch_out", minutes: timeToMinutes(schedule.lunch_out_time) },
    { field: "lunch_in", minutes: timeToMinutes(schedule.lunch_in_time) },
    { field: "clock_out", minutes: timeToMinutes(schedule.clock_out_time) },
  ];
  // Find the next slot that should logically be punched given current time.
  // A slot is "missing" if its scheduled time is already passed (>= 15 min in the past)
  // and it's still null AND a later slot would otherwise be the next action.
  const filled = (f: PunchField) => !!record?.[f];
  for (let i = 0; i < scheduleSlots.length - 1; i++) {
    const slot = scheduleSlots[i];
    const next = scheduleSlots[i + 1];
    if (!filled(slot.field) && nowMinutes >= next.minutes - 15) {
      // Slot was skipped; user is now at or near the next slot's expected time
      return {
        missing_slot: slot.field,
        suggested_time: scheduleSlots[i].minutes
          ? `${String(Math.floor(slot.minutes / 60)).padStart(2, "0")}:${String(slot.minutes % 60).padStart(2, "0")}`
          : "00:00",
        next_action: next.field,
      };
    }
  }
  return null;
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

type PunchField = "clock_in" | "lunch_out" | "lunch_in" | "clock_out";

const punchFields: PunchField[] = ["clock_in", "lunch_out", "lunch_in", "clock_out"];

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

export function minutesToHHMM(mins: number): string {
  const sign = mins < 0 ? "-" : "+";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

export function hasAnyPunch(record: TimeClockRecordLike | null | undefined): boolean {
  return !!(record?.clock_in || record?.lunch_out || record?.lunch_in || record?.clock_out);
}

export function scheduledWorkMinutes(schedule: ScheduleLike): number {
  if (schedule.is_day_off) return 0;
  if (isPartTimeSchedule(schedule)) {
    return Math.max(0, timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time));
  }
  const morning = Math.max(0, timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time));
  const afternoon = Math.max(0, timeToMinutes(schedule.clock_out_time) - timeToMinutes(schedule.lunch_in_time));
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

export function normalizeTimeRecord<T extends TimeClockRecordLike | null | undefined>(
  record: T,
  schedule: ScheduleLike | null | undefined
): TimeClockRecordLike {
  const empty = { clock_in: null, lunch_out: null, lunch_in: null, clock_out: null };
  if (!record || !schedule || schedule.is_day_off) return { ...empty, ...(record || {}) };

  const punches = punchFields
    .map((field) => ({ field, ts: record[field] || null }))
    .filter((p): p is { field: PunchField; ts: string } => !!p.ts)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  if (punches.length === 0) return empty;

  if (isPartTimeSchedule(schedule)) {
    return { ...empty, clock_in: punches[0]?.ts || null, lunch_out: punches[punches.length - 1]?.ts || null };
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

function calcPeriodDiff(
  actualStartTs: string,
  actualEndTs: string,
  scheduledStart: string,
  scheduledEnd: string,
  tolerances: Tolerances,
  creditOvertimeAtEnd: boolean
): number {
  const actualStart = timestampToLisbonMinutes(actualStartTs);
  const actualEnd = timestampToLisbonMinutes(actualEndTs);
  const schedStart = timeToMinutes(scheduledStart);
  const schedEnd = timeToMinutes(scheduledEnd);

  const lateMinutes = Math.max(0, actualStart - schedStart);
  const earlyLeaveMinutes = Math.max(0, schedEnd - actualEnd);
  const overtimeMinutes = Math.max(0, actualEnd - schedEnd);

  // Debit ONLY the minutes beyond the tolerance window.
  const lateDeficit = lateMinutes > tolerances.tolerance_late_minutes
    ? lateMinutes - tolerances.tolerance_late_minutes
    : 0;
  // Early leave: no tolerance — debit from the 1st minute (always against the employee).
  const earlyDeficit = earlyLeaveMinutes;
  const overtimeCredit = creditOvertimeAtEnd && overtimeMinutes > tolerances.tolerance_overtime_minutes
    ? overtimeMinutes - tolerances.tolerance_overtime_minutes
    : 0;

  return overtimeCredit - lateDeficit - earlyDeficit;
}

function calcDiffWithTolerances(record: Required<TimeClockRecordLike>, schedule: ScheduleLike, tolerances: Tolerances): number {
  const actualIn = timestampToLisbonMinutes(record.clock_in);
  const actualOut = timestampToLisbonMinutes(record.clock_out);
  const schedIn = timeToMinutes(schedule.clock_in_time);
  const schedOut = timeToMinutes(schedule.clock_out_time);
  const schedLunchOut = timeToMinutes(schedule.lunch_out_time);
  const schedLunchIn = timeToMinutes(schedule.lunch_in_time);

  const lateMinutes = Math.max(0, actualIn - schedIn);
  const entryDeficit = lateMinutes > tolerances.tolerance_late_minutes
    ? lateMinutes - tolerances.tolerance_late_minutes
    : 0;

  const exitExtra = Math.max(0, actualOut - schedOut);
  const earlyLeaveMinutes = Math.max(0, schedOut - actualOut);
  const exitCredit = exitExtra > tolerances.tolerance_overtime_minutes ? exitExtra - tolerances.tolerance_overtime_minutes : 0;
  // Early leave: no tolerance — debit from the 1st minute.
  const exitDeficit = earlyLeaveMinutes;

  let lunchPenalty = 0;
  if (record.lunch_out) {
    const lunchLeaveEarly = Math.max(0, schedLunchOut - timestampToLisbonMinutes(record.lunch_out));
    // Leaving for lunch earlier than scheduled: no tolerance — counts from the 1st minute.
    lunchPenalty += lunchLeaveEarly;
  }
  if (record.lunch_in) {
    const lunchReturnLate = Math.max(0, timestampToLisbonMinutes(record.lunch_in) - schedLunchIn);
    if (lunchReturnLate > tolerances.tolerance_late_minutes) {
      lunchPenalty += lunchReturnLate - tolerances.tolerance_late_minutes;
    }
  }

  return exitCredit - entryDeficit - exitDeficit - lunchPenalty;
}

export function calculateWorkedMinutes(record: TimeClockRecordLike | null | undefined, schedule: ScheduleLike): number {
  const normalized = normalizeTimeRecord(record, schedule);
  if (!hasAnyPunch(normalized) || schedule.is_day_off) return 0;

  if (isPartTimeSchedule(schedule)) {
    const effectiveOut = normalized.lunch_out || normalized.clock_out;
    return normalized.clock_in && effectiveOut
      ? Math.max(0, timestampToLisbonMinutes(effectiveOut) - timestampToLisbonMinutes(normalized.clock_in))
      : 0;
  }

  if (normalized.clock_in && normalized.clock_out && normalized.lunch_out && normalized.lunch_in) {
    return Math.max(
      0,
      timestampToLisbonMinutes(normalized.clock_out) - timestampToLisbonMinutes(normalized.clock_in)
      - (timestampToLisbonMinutes(normalized.lunch_in) - timestampToLisbonMinutes(normalized.lunch_out))
    );
  }

  if (normalized.clock_in && normalized.clock_out && !normalized.lunch_out && !normalized.lunch_in) {
    const scheduledLunch = timeToMinutes(schedule.lunch_in_time) - timeToMinutes(schedule.lunch_out_time);
    return Math.max(0, timestampToLisbonMinutes(normalized.clock_out) - timestampToLisbonMinutes(normalized.clock_in) - scheduledLunch);
  }

  let worked = 0;
  if (normalized.clock_in && normalized.lunch_out) {
    worked += Math.max(0, timestampToLisbonMinutes(normalized.lunch_out) - timestampToLisbonMinutes(normalized.clock_in));
  }
  if (normalized.lunch_in && normalized.clock_out) {
    worked += Math.max(0, timestampToLisbonMinutes(normalized.clock_out) - timestampToLisbonMinutes(normalized.lunch_in));
  }
  return worked;
}

export function calculateWorkday(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike,
  tolerances: Tolerances
): { scheduled: number; worked: number; diff: number; incomplete: boolean; normalized: TimeClockRecordLike } {
  const scheduled = scheduledWorkMinutes(schedule);
  const normalized = normalizeTimeRecord(record, schedule);
  if (schedule.is_day_off || !hasAnyPunch(normalized)) return { scheduled, worked: 0, diff: 0, incomplete: false, normalized };

  const worked = calculateWorkedMinutes(normalized, schedule);

  if (isPartTimeSchedule(schedule)) {
    const effectiveOut = normalized.lunch_out || normalized.clock_out;
    if (!normalized.clock_in || !effectiveOut) return { scheduled, worked, diff: -scheduled, incomplete: true, normalized };
    return {
      scheduled,
      worked,
      diff: calcPeriodDiff(normalized.clock_in, effectiveOut, schedule.clock_in_time, schedule.lunch_out_time, tolerances, true),
      incomplete: false,
      normalized,
    };
  }

  const hasCompleteDay = !!(normalized.clock_in && normalized.clock_out && ((normalized.lunch_out && normalized.lunch_in) || (!normalized.lunch_out && !normalized.lunch_in)));
  if (hasCompleteDay) {
    const diff = calcDiffWithTolerances(normalized as Required<TimeClockRecordLike>, schedule, tolerances);
    return { scheduled, worked, diff, incomplete: !(normalized.lunch_out && normalized.lunch_in), normalized };
  }

  const morningScheduled = Math.max(0, timeToMinutes(schedule.lunch_out_time) - timeToMinutes(schedule.clock_in_time));
  const afternoonScheduled = Math.max(0, timeToMinutes(schedule.clock_out_time) - timeToMinutes(schedule.lunch_in_time));
  let diff = 0;

  if (normalized.clock_in && normalized.lunch_out) {
    diff += calcPeriodDiff(normalized.clock_in, normalized.lunch_out, schedule.clock_in_time, schedule.lunch_out_time, tolerances, false);
  } else if (normalized.clock_in && (normalized.lunch_in || normalized.clock_out)) {
    const lateMinutes = Math.max(0, timestampToLisbonMinutes(normalized.clock_in) - timeToMinutes(schedule.clock_in_time));
    diff -= lateMinutes > tolerances.tolerance_late_minutes ? lateMinutes - tolerances.tolerance_late_minutes : 0;
  } else {
    diff -= morningScheduled;
  }

  if (normalized.lunch_in && normalized.clock_out) {
    diff += calcPeriodDiff(normalized.lunch_in, normalized.clock_out, schedule.lunch_in_time, schedule.clock_out_time, tolerances, true);
  } else if ((normalized.clock_in || normalized.lunch_out) && normalized.clock_out) {
    const earlyMinutes = Math.max(0, timeToMinutes(schedule.clock_out_time) - timestampToLisbonMinutes(normalized.clock_out));
    const extraMinutes = Math.max(0, timestampToLisbonMinutes(normalized.clock_out) - timeToMinutes(schedule.clock_out_time));
    diff += extraMinutes > tolerances.tolerance_overtime_minutes ? extraMinutes - tolerances.tolerance_overtime_minutes : 0;
    // Early leave: no tolerance — debit from the 1st minute.
    diff -= earlyMinutes;
  } else {
    diff -= afternoonScheduled;
  }

  return { scheduled, worked, diff, incomplete: true, normalized };
}