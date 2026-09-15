import { describe, it, expect } from "vitest";
import { evaluateDay, detectOvertimeCandidate, detectEarlyEntryCandidate } from "./attendanceEngine";
import { computeMonthlyAttendance, type AttendanceDay } from "./attendanceReconciliation";

const schedule = {
  clock_in_time: "08:00:00",
  lunch_out_time: "12:00:00",
  lunch_in_time: "13:00:00",
  clock_out_time: "17:00:00",
  is_day_off: false,
};

/** Part-time: entra às 08:00 e sai às 12:00 (lunch_in/clock_out a 00:00). */
const partTime = {
  clock_in_time: "08:00:00",
  lunch_out_time: "12:00:00",
  lunch_in_time: "00:00:00",
  clock_out_time: "00:00:00",
  is_day_off: false,
};

const t = (hhmm: string) => `2026-05-15T${hhmm}:00+01:00`;

describe("evaluateDay — sem dupla compensação", () => {
  it("atraso 60 (tol 10) + saída extra 60 (tol 15): défice bruto 50 e candidato 45", () => {
    const ev = evaluateDay(
      { clock_in: t("09:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("18:00") },
      schedule,
    );
    expect(ev.deficitMinutes).toBe(50);
    expect(ev.overtimeCandidateMinutes).toBe(45);
    // Validado: crédito aprovado (45) − débito de conciliação (50) = −5
    expect(ev.overtimeCandidateMinutes - ev.deficitMinutes).toBe(-5);
  });
});

describe("evaluateDay — entrada antecipada", () => {
  it("por omissão (tolerância 0) mostra todos os minutos brutos como candidato", () => {
    const ev = evaluateDay(
      { clock_in: t("07:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("17:00") },
      schedule,
    );
    expect(ev.earlyEntryMinutes).toBe(60);
    expect(ev.earlyEntryCandidateMinutes).toBe(60); // default 0 — nada é descontado
    expect(ev.deficitMinutes).toBe(0);
  });

  it("tolerância configurada corta apenas o ruído indicado", () => {
    const ev = evaluateDay(
      { clock_in: t("07:50"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("17:00") },
      schedule,
      { tolerance_early_entry_minutes: 15 },
    );
    expect(ev.earlyEntryMinutes).toBe(10);
    expect(ev.earlyEntryCandidateMinutes).toBe(0);
  });

  it("tolerância de entrada antecipada é configurável", () => {
    const ev = evaluateDay({ clock_in: t("07:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("17:00") }, schedule, {
      tolerance_early_entry_minutes: 0,
    });
    expect(ev.earlyEntryCandidateMinutes).toBe(60);
  });
});

describe("evaluateDay — dias incompletos", () => {
  it("apenas entrada: incompleto, marcado para revisão, sem débito", () => {
    const ev = evaluateDay({ clock_in: t("08:00") }, schedule);
    expect(ev.incomplete).toBe(true);
    expect(ev.needsReview).toBe(true);
    expect(ev.deficitMinutes).toBe(0);
    expect(ev.reviewReasons).toContain("missing_punch");
  });

  it("almoço desemparelhado: revisão, sem débito", () => {
    const ev = evaluateDay({ clock_in: t("08:00"), lunch_out: t("12:00"), clock_out: t("17:00") }, schedule);
    expect(ev.needsReview).toBe(true);
    expect(ev.reviewReasons).toContain("unpaired_lunch");
    expect(ev.deficitMinutes).toBe(0);
  });

  it("part-time com uma única picagem não é duplicada como entrada e saída", () => {
    const ev = evaluateDay({ clock_in: t("08:00") }, partTime);
    expect(ev.incomplete).toBe(true);
    expect(ev.worked).toBe(0);
    expect(ev.deficitMinutes).toBe(0);
    expect(ev.reviewReasons).toContain("part_time_single_punch");
  });

  it("part-time com duas picagens é completo", () => {
    const ev = evaluateDay({ clock_in: t("08:00"), lunch_out: t("12:00") }, partTime);
    expect(ev.incomplete).toBe(false);
    expect(ev.worked).toBe(240);
    expect(ev.deficitMinutes).toBe(0);
  });

  it("dia sem qualquer picagem não debita (é matéria do módulo de faltas)", () => {
    const ev = evaluateDay(null, schedule);
    expect(ev.noRecord).toBe(true);
    expect(ev.deficitMinutes).toBe(0);
    expect(ev.needsReview).toBe(false);
  });
});

describe("computeMonthlyAttendance", () => {
  it("soma défices brutos e sinaliza dias por rever sem os debitar", () => {
    const days: AttendanceDay[] = [
      { date: "2026-05-04", schedule, record: { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("16:30") } },
      { date: "2026-05-05", schedule, record: { clock_in: t("09:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("18:00") } },
      { date: "2026-05-06", schedule, record: { clock_in: t("08:00") } },
    ];
    const s = computeMonthlyAttendance(days);
    expect(s.debitMinutes).toBe(30 + 50);
    expect(s.overtimeCandidateMinutes).toBe(45);
    expect(s.reviewDates).toEqual(["2026-05-06"]);
  });

  it("minutos já compensados não são debitados de novo", () => {
    const days: AttendanceDay[] = [
      {
        date: "2026-05-04",
        schedule,
        record: { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("16:30") },
        compensatedMinutes: 30,
      },
    ];
    expect(computeMonthlyAttendance(days).debitMinutes).toBe(0);
  });

  it("férias/feriados marcados como skip não produzem débito", () => {
    const days: AttendanceDay[] = [
      { date: "2026-05-04", schedule, record: { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("15:00") }, skip: true },
    ];
    expect(computeMonthlyAttendance(days).debitMinutes).toBe(0);
  });
});

describe("evaluateDay — jornada com pausa exige as 4 picagens", () => {
  it("entrada + saída sem picagens de almoço fica por validar, sem débito nem candidato", () => {
    const ev = evaluateDay({ clock_in: t("08:00"), clock_out: t("17:00") }, schedule);
    expect(ev.needsReview).toBe(true);
    expect(ev.reviewReasons).toContain("missing_lunch_punches");
    expect(ev.deficitMinutes).toBe(0);
    expect(ev.overtimeCandidateMinutes).toBe(0);
  });

  it("part-time não exige picagens de almoço", () => {
    const ev = evaluateDay({ clock_in: t("08:00"), lunch_out: t("12:00") }, partTime);
    expect(ev.needsReview).toBe(false);
    expect(ev.worked).toBe(240);
  });

  it("turno noturno não modelado é marcado para validação explícita", () => {
    const night = { clock_in_time: "22:00:00", lunch_out_time: "02:00:00", lunch_in_time: "02:30:00", clock_out_time: "06:00:00", is_day_off: false };
    const ev = evaluateDay({ clock_in: t("22:00") }, night);
    expect(ev.needsReview).toBe(true);
    expect(ev.reviewReasons).toContain("overnight_shift");
  });
});

describe("candidatos partilhados com o servidor", () => {
  it("saída tardia gera candidato e entrada antecipada gera candidato separado", () => {
    const rec = { clock_in: t("07:30"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("18:00") };
    expect(detectEarlyEntryCandidate(rec, schedule)?.minutes).toBe(30);
    expect(detectOvertimeCandidate(rec, schedule)?.minutes).toBe(45);
  });

  it("dia por validar não gera qualquer candidato", () => {
    const rec = { clock_in: t("07:30"), clock_out: t("18:00") };
    expect(detectEarlyEntryCandidate(rec, schedule)).toBeNull();
    expect(detectOvertimeCandidate(rec, schedule)).toBeNull();
  });
});
