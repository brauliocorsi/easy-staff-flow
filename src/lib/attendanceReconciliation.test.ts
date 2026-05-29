import { describe, it, expect } from "vitest";
import {
  computeMonthlyNegativeDiff, computePendingAttendanceDebit,
  type AttendanceDay,
} from "./attendanceReconciliation";

const schedule = {
  clock_in_time: "08:00:00",
  lunch_out_time: "12:00:00",
  lunch_in_time: "13:00:00",
  clock_out_time: "17:00:00",
  is_day_off: false,
};

// Helper: build ISO timestamp in Lisbon assumption (no DST edge tested here).
const t = (hhmm: string) => `2026-05-15T${hhmm}:00+01:00`;

describe("computeMonthlyNegativeDiff", () => {
  it("soma apenas dias com diff negativo", () => {
    const days: AttendanceDay[] = [
      // dia perfeito → 0
      { schedule, record: { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("17:00") } },
      // saída 30 min antecipada → -30
      { schedule, record: { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("16:30") } },
      // entrada 1h tarde (tolerância 10) → -50
      { schedule, record: { clock_in: t("09:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("17:00") } },
    ];
    expect(computeMonthlyNegativeDiff(days)).toBe(80);
  });

  it("ignora diferenças positivas (overtime)", () => {
    const days: AttendanceDay[] = [
      // 1h extra (>15 tolerância) → +45 mas não conta
      { schedule, record: { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("18:00") } },
    ];
    expect(computeMonthlyNegativeDiff(days)).toBe(0);
  });

  it("ignora dias sem horário, dia de folga ou marcados skip", () => {
    const days: AttendanceDay[] = [
      { schedule: null, record: null },
      { schedule: { ...schedule, is_day_off: true }, record: null },
      { schedule, record: { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("16:00") }, skip: true },
    ];
    expect(computeMonthlyNegativeDiff(days)).toBe(0);
  });
});

describe("computePendingAttendanceDebit", () => {
  it("subtrai débitos já lançados", () => {
    expect(computePendingAttendanceDebit(535, 0)).toBe(535);
    expect(computePendingAttendanceDebit(535, 535)).toBe(0);
    expect(computePendingAttendanceDebit(535, 600)).toBe(0);
  });
});