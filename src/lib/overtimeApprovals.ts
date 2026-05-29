import {
  calculateWorkday,
  isPartTimeSchedule,
  scheduledWorkMinutes,
  timeToMinutes,
  timestampToLisbonMinutes,
  type ScheduleLike,
  type TimeClockRecordLike,
  type Tolerances,
} from "./timeClock";

export type ApprovalKind = "overtime" | "day_off_work" | "holiday_work";
export type ApprovalStatus = "approved" | "pending" | "rejected";
/** Status used in the frontend when no row exists in `overtime_approvals` yet. */
export type LogicalStatus = ApprovalStatus | "not_submitted";

export type ApprovalLike = {
  kind: ApprovalKind;
  minutes: number;
  status: LogicalStatus;
};

export type BalanceSplit = {
  /** Official balance the company recognises. */
  approved: number;
  /** Minutes awaiting approval. */
  pending: number;
  /** Minutes already rejected (informative only). */
  rejected: number;
  /** approved + pending — what the balance could become. */
  potential: number;
};

/**
 * Splits the monthly balance into approved / pending / rejected / potential.
 *
 * IMPORTANT: `dailyDiffSum` is the sum of the Fase 1 daily diffs. Fase 1
 * already credits overtime (the part beyond the tolerance) into that diff,
 * so for `kind="overtime"` we must SUBTRACT the minutes from `approved`
 * whenever the approval is not yet approved. Otherwise the official balance
 * would include overtime that no manager validated.
 *
 * Rules:
 *  - overtime + approved      → keep in approved (already inside dailyDiffSum)
 *  - overtime + pending/not_submitted → subtract from approved, add to pending
 *  - overtime + rejected      → subtract from approved, add to rejected
 *  - day_off_work/holiday_work + approved → add to approved (Fase 1 does NOT credit these)
 *  - day_off_work/holiday_work + pending/not_submitted → add to pending only
 *  - day_off_work/holiday_work + rejected → add to rejected only (informative)
 *
 *  potential = approved + pending  (never includes rejected)
 */
export function splitBalance(dailyDiffSum: number, approvals: ApprovalLike[]): BalanceSplit {
  let approved = dailyDiffSum;
  let pending = 0;
  let rejected = 0;

  for (const a of approvals) {
    const isPending = a.status === "pending" || a.status === "not_submitted";

    if (a.kind === "overtime") {
      if (a.status === "approved") {
        // already inside dailyDiffSum — no change
      } else if (isPending) {
        approved -= a.minutes;
        pending += a.minutes;
      } else if (a.status === "rejected") {
        approved -= a.minutes;
        rejected += a.minutes;
      }
    } else {
      // day_off_work | holiday_work
      if (a.status === "approved") {
        approved += a.minutes;
      } else if (isPending) {
        pending += a.minutes;
      } else if (a.status === "rejected") {
        rejected += a.minutes;
      }
    }
  }

  return { approved, pending, rejected, potential: approved + pending };
}

/**
 * Detects how many minutes of OVERTIME a regular workday produced beyond the
 * tolerance. Returns null when there is no overtime candidate.
 */
export function detectOvertimeCandidate(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike,
  tolerances: Tolerances
): { minutes: number; toleranceApplied: number } | null {
  if (!record || schedule.is_day_off) return null;
  const wd = calculateWorkday(record, schedule, tolerances);
  if (wd.incomplete) return null;

  const normalized = wd.normalized;
  const effectiveOut = isPartTimeSchedule(schedule)
    ? normalized.lunch_out || normalized.clock_out
    : normalized.clock_out;
  if (!effectiveOut) return null;

  const scheduledOut = isPartTimeSchedule(schedule)
    ? timeToMinutes(schedule.lunch_out_time)
    : timeToMinutes(schedule.clock_out_time);
  const actualOut = timestampToLisbonMinutes(effectiveOut);
  const extra = actualOut - scheduledOut;
  if (extra <= tolerances.tolerance_overtime_minutes) return null;

  return {
    minutes: extra - tolerances.tolerance_overtime_minutes,
    toleranceApplied: tolerances.tolerance_overtime_minutes,
  };
}

/**
 * Detects exceptional work (day-off or holiday) when the employee punched.
 * Returns minutes of effective work, or null if there is nothing to approve.
 */
export function detectExceptionalWork(
  record: TimeClockRecordLike | null | undefined,
  schedule: ScheduleLike | null | undefined,
  isHoliday: boolean
): { kind: Exclude<ApprovalKind, "overtime">; minutes: number } | null {
  if (!record) return null;
  const hasPunch = !!(record.clock_in || record.clock_out || record.lunch_in || record.lunch_out);
  if (!hasPunch) return null;

  const inTs = record.clock_in;
  const outTs = record.clock_out || record.lunch_in || record.lunch_out;
  if (!inTs || !outTs) return null;

  let worked = Math.max(0, timestampToLisbonMinutes(outTs) - timestampToLisbonMinutes(inTs));
  if (record.lunch_out && record.lunch_in) {
    worked -= Math.max(
      0,
      timestampToLisbonMinutes(record.lunch_in) - timestampToLisbonMinutes(record.lunch_out)
    );
  }
  worked = Math.max(0, worked);
  if (worked <= 0) return null;

  if (isHoliday) return { kind: "holiday_work", minutes: worked };
  if (schedule?.is_day_off || !schedule) return { kind: "day_off_work", minutes: worked };
  return null;
}

/** Helper for the UI: scheduled minutes used as fallback when day_off schedule unknown. */
export function scheduledFallbackMinutes(schedule: ScheduleLike | null | undefined): number {
  return schedule ? scheduledWorkMinutes(schedule) : 480;
}