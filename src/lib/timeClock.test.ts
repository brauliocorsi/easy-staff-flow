import { describe, it, expect } from "vitest";
import { calculateWorkday, DEFAULT_TOLERANCES, type ScheduleLike } from "./timeClock";

const schedule: ScheduleLike = {
  clock_in_time: "08:00:00",
  lunch_out_time: "12:00:00",
  lunch_in_time: "13:00:00",
  clock_out_time: "17:00:00",
  is_day_off: false,
};

/** Build a Lisbon-local ISO timestamp for a given HH:mm on 2026-01-15 (no DST shift). */
function ts(hhmm: string): string {
  return `2026-01-15T${hhmm}:00+00:00`;
}

describe("calculateWorkday — Fase 1 cenários", () => {
  it("Cenário 1: entrada 08:08 / saída 17:00 → saldo 0 (dentro da tolerância de 10m)", () => {
    const r = calculateWorkday(
      { clock_in: ts("08:08"), lunch_out: ts("12:00"), lunch_in: ts("13:00"), clock_out: ts("17:00") },
      schedule,
      DEFAULT_TOLERANCES
    );
    expect(r.diff).toBe(0);
    expect(r.scheduled).toBe(480);
  });

  it("Cenário 2: entrada 08:17 / saída 17:00 → saldo -7m (atraso 17m − tolerância 10m)", () => {
    const r = calculateWorkday(
      { clock_in: ts("08:17"), lunch_out: ts("12:00"), lunch_in: ts("13:00"), clock_out: ts("17:00") },
      schedule,
      DEFAULT_TOLERANCES
    );
    expect(r.diff).toBe(-7);
  });

  it("Cenário 3: entrada 08:00 / saída 17:40 → crédito +25m (extra 40m − tolerância 15m)", () => {
    const r = calculateWorkday(
      { clock_in: ts("08:00"), lunch_out: ts("12:00"), lunch_in: ts("13:00"), clock_out: ts("17:40") },
      schedule,
      DEFAULT_TOLERANCES
    );
    expect(r.diff).toBe(25);
  });

  it("Cenário 4: entrada 08:00 / saída 16:50 → saldo -10m (sem tolerância de saída antecipada)", () => {
    const r = calculateWorkday(
      { clock_in: ts("08:00"), lunch_out: ts("12:00"), lunch_in: ts("13:00"), clock_out: ts("16:50") },
      schedule,
      DEFAULT_TOLERANCES
    );
    expect(r.diff).toBe(-10);
  });

  it("Saída 16:59 → -1m (saída antecipada debita do 1º minuto)", () => {
    const r = calculateWorkday(
      { clock_in: ts("08:00"), lunch_out: ts("12:00"), lunch_in: ts("13:00"), clock_out: ts("16:59") },
      schedule,
      DEFAULT_TOLERANCES
    );
    expect(r.diff).toBe(-1);
  });

  it("Saída 16:55 → -5m (sem tolerância de saída antecipada)", () => {
    const r = calculateWorkday(
      { clock_in: ts("08:00"), lunch_out: ts("12:00"), lunch_in: ts("13:00"), clock_out: ts("16:55") },
      schedule,
      DEFAULT_TOLERANCES
    );
    expect(r.diff).toBe(-5);
  });

  it("Saída 17:14 (extra 14m) → saldo 0 (dentro da tolerância de extras)", () => {
    const r = calculateWorkday(
      { clock_in: ts("08:00"), lunch_out: ts("12:00"), lunch_in: ts("13:00"), clock_out: ts("17:14") },
      schedule,
      DEFAULT_TOLERANCES
    );
    expect(r.diff).toBe(0);
  });
});