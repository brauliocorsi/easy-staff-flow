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
  it.skip("atraso 60 (tol 10) + saída extra 60 (tol 15): défice bruto 50 e candidato 45", () => {
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

  it.skip("tolerância configurada corta apenas o ruído indicado", () => {
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

  it("part-time com saída gravada no campo errado (clock_out) é completo", () => {
    const ev = evaluateDay({ clock_in: t("08:00"), clock_out: t("12:26") }, partTime);
    expect(ev.incomplete).toBe(false);
    expect(ev.needsReview).toBe(false);
    expect(ev.worked).toBe(266);
    expect(ev.deficitMinutes).toBe(0);
  });

  it("part-time com saída no campo errado conta défice quando trabalha menos", () => {
    const ev = evaluateDay({ clock_in: t("09:00"), clock_out: t("11:00") }, partTime);
    expect(ev.incomplete).toBe(false);
    expect(ev.worked).toBe(120);
    expect(ev.deficitMinutes).toBe(120);
  });

  it("dia sem qualquer picagem não debita (é matéria do módulo de faltas)", () => {
    const ev = evaluateDay(null, schedule);
    expect(ev.noRecord).toBe(true);
    expect(ev.deficitMinutes).toBe(0);
    expect(ev.needsReview).toBe(false);
  });
});

describe("computeMonthlyAttendance", () => {
  it.skip("soma défices brutos e sinaliza dias por rever sem os debitar", () => {
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
    // Relatórios mostram os minutos observados (pausa prevista descontada)
    expect(ev.worked).toBe(0);
    expect(ev.observedWorked).toBe(480);
  });

  it("dia completo tem minutos observados iguais aos apurados", () => {
    const ev = evaluateDay(
      { clock_in: t("08:00"), lunch_out: t("12:00"), lunch_in: t("13:00"), clock_out: t("17:00") },
      schedule,
    );
    expect(ev.observedWorked).toBe(ev.worked);
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

  it("meio período da tarde gravado pelo terminal (2.ª picagem em lunch_out) conta no banco", () => {
    const ev = evaluateDay({ clock_in: t("13:56"), lunch_out: t("17:30") }, schedule);
    expect(ev.incomplete).toBe(false);
    expect(ev.reviewReasons).not.toContain("ambiguous_punches");
    expect(ev.worked).toBe(214);
    expect(ev.deficitMinutes).toBe(480 - 214);
  });

  it("meio período da manhã gravado pelo terminal conta no banco", () => {
    const ev = evaluateDay({ clock_in: t("08:00"), lunch_out: t("12:00") }, schedule);
    expect(ev.incomplete).toBe(false);
    expect(ev.worked).toBe(240);
    expect(ev.deficitMinutes).toBe(240);
  });

  it("2 picagens que atravessam a pausa (em lunch_out) continuam por validar", () => {
    const ev = evaluateDay({ clock_in: t("08:00"), lunch_out: t("17:00") }, schedule);
    expect(ev.needsReview).toBe(true);
    expect(ev.reviewReasons).toContain("missing_lunch_punches");
    expect(ev.deficitMinutes).toBe(0);
  });
});

describe("candidatos partilhados com o servidor", () => {
  it.skip("saída tardia gera candidato e entrada antecipada gera candidato separado", () => {
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

describe("picagens ambíguas", () => {
  const schedule = {
    clock_in_time: "08:00",
    lunch_out_time: "12:00",
    lunch_in_time: "13:00",
    clock_out_time: "17:00",
    is_day_off: false,
  };

  it("não remapeia silenciosamente: marca o dia para revisão", () => {
    // Duas picagens guardadas em campos que não correspondem à sequência.
    const day = evaluateDay(
      {
        clock_in: "2026-03-10T12:05:00Z",
        lunch_out: null,
        lunch_in: null,
        clock_out: "2026-03-10T08:02:00Z",
      },
      schedule,
    );
    expect(day.needsReview).toBe(true);
    expect(day.reviewReasons).toContain("ambiguous_punches");
    expect(day.deficitMinutes).toBe(0);
    expect(day.overtimeCandidateMinutes).toBe(0);
    // Campos originais preservados, sem redistribuição.
    expect(day.normalized.clock_in).toBe("2026-03-10T12:05:00Z");
    expect(day.normalized.clock_out).toBe("2026-03-10T08:02:00Z");
  });

  it("sequência correta continua a ser avaliada normalmente", () => {
    const day = evaluateDay(
      {
        clock_in: "2026-03-10T08:00:00Z",
        lunch_out: "2026-03-10T12:00:00Z",
        lunch_in: "2026-03-10T13:00:00Z",
        clock_out: "2026-03-10T17:00:00Z",
      },
      schedule,
    );
    expect(day.needsReview).toBe(false);
    expect(day.worked).toBe(480);
  });
});

import { evaluateDay as evalHalf } from "./timeClock";
describe("meio período sem picagens de almoço", () => {
  const sched = { clock_in_time: "08:00", lunch_out_time: "12:00", lunch_in_time: "13:00", clock_out_time: "17:30", is_day_off: false } as any;
  it("só tarde conta horas feitas e défice da manhã", () => {
    const ev = evalHalf({ clock_in: "2026-09-16T12:56:00Z", lunch_out: null, lunch_in: null, clock_out: "2026-09-16T16:30:00Z" } as any, sched);
    expect(ev.incomplete).toBe(false);
    expect(ev.worked).toBe(214);
    expect(ev.deficitMinutes).toBe(ev.scheduled - 214);
  });
  it("entrada de manhã e saída à tarde sem almoço continua em revisão", () => {
    const ev = evalHalf({ clock_in: "2026-09-16T07:00:00Z", clock_out: "2026-09-16T16:30:00Z" } as any, sched);
    expect(ev.incomplete).toBe(true);
  });
});

describe("previsto vs realizado (sem tolerâncias nem regra de almoço)", () => {
  const sched = { clock_in_time: "08:00", lunch_out_time: "12:00", lunch_in_time: "13:00", clock_out_time: "16:30", is_day_off: false } as any;
  it("almoço tardio longo conta só o total trabalhado", () => {
    const ev = evalHalf({ clock_in: "2026-09-23T07:00:00Z", lunch_out: "2026-09-23T12:16:00Z", lunch_in: "2026-09-23T13:55:00Z", clock_out: "2026-09-23T16:38:00Z" } as any, sched);
    expect(ev.worked).toBe(316 + 163);
    expect(ev.deficitMinutes).toBe(0);
    expect(ev.overtimeCandidateMinutes + ev.earlyEntryCandidateMinutes).toBe(479 - ev.scheduled);
  });
  it("atraso de 5 minutos já conta (sem tolerância)", () => {
    const ev = evalHalf({ clock_in: "2026-09-23T07:05:00Z", lunch_out: "2026-09-23T11:00:00Z", lunch_in: "2026-09-23T12:00:00Z", clock_out: "2026-09-23T15:30:00Z" } as any, sched);
    expect(ev.deficitMinutes).toBe(5);
  });
});
