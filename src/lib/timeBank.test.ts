import { describe, it, expect } from "vitest";
import { computeBalance, computeMonthlyClosure, type MovementLike } from "./timeBank";

const mk = (m: Partial<MovementLike>): MovementLike => ({
  source_type: "overtime",
  movement_type: "credit",
  minutes: 0,
  effective_minutes: 0,
  status: "pending",
  ...m,
});

describe("computeBalance — conta-corrente do banco de horas", () => {
  it("Caso 1 — overtime pendente: aparece em pending e potential, não em approved", () => {
    const r = computeBalance([
      mk({ status: "pending", minutes: 25, decision: "credit_to_bank" }),
    ]);
    expect(r).toEqual({ approved: 0, pending: 25, paid: 0, rejected: 0, used: 0, available: 0, potential: 25 });
  });

  it("Caso 2 — overtime creditada no banco", () => {
    const r = computeBalance([
      mk({ status: "approved", minutes: 25, effective_minutes: 25, decision: "credit_to_bank" }),
    ]);
    expect(r).toEqual({ approved: 25, pending: 0, paid: 0, rejected: 0, used: 0, available: 25, potential: 25 });
  });

  it("Caso 3 — overtime paga: aparece em paid apenas", () => {
    const r = computeBalance([
      mk({ status: "paid", movement_type: "neutral", minutes: 25, effective_minutes: 0, decision: "pay_as_overtime" }),
    ]);
    expect(r).toEqual({ approved: 0, pending: 0, paid: 25, rejected: 0, used: 0, available: 0, potential: 0 });
  });

  it("Caso 4 — overtime rejeitada: aparece em rejected apenas", () => {
    const r = computeBalance([
      mk({ status: "rejected", minutes: 25, decision: "reject" }),
    ]);
    expect(r).toEqual({ approved: 0, pending: 0, paid: 0, rejected: 25, used: 0, available: 0, potential: 0 });
  });

  it("Caso 5 — trabalho em feriado pendente (8h)", () => {
    const r = computeBalance([
      mk({ source_type: "holiday_work", status: "pending", minutes: 480 }),
    ]);
    expect(r.approved).toBe(0);
    expect(r.pending).toBe(480);
    expect(r.potential).toBe(480);
  });

  it("Caso 6 — trabalho em dia de folga pendente (6h)", () => {
    const r = computeBalance([
      mk({ source_type: "day_off_work", status: "pending", minutes: 360 }),
    ]);
    expect(r.pending).toBe(360);
    expect(r.approved).toBe(0);
  });

  it("Caso 7 — uso de banco: crédito 6h + débito 2h aprovados", () => {
    const r = computeBalance([
      mk({ status: "approved", minutes: 360, effective_minutes: 360, decision: "credit_to_bank" }),
      mk({
        source_type: "compensation_used",
        movement_type: "debit",
        status: "approved",
        minutes: 120,
        effective_minutes: -120,
        decision: "use_bank_hours",
      }),
    ]);
    expect(r.approved).toBe(240);
    expect(r.available).toBe(240);
    expect(r.used).toBe(120);
    expect(r.potential).toBe(240);
  });

  it("Caso 8 — abater saldo negativo: -3h prévias + 2h aprovadas = -1h", () => {
    const r = computeBalance([
      mk({
        source_type: "manual_adjustment",
        movement_type: "debit",
        status: "approved",
        minutes: 180,
        effective_minutes: -180,
      }),
      mk({
        status: "approved",
        minutes: 120,
        effective_minutes: 120,
        decision: "offset_negative_balance",
      }),
    ]);
    expect(r.approved).toBe(-60);
    expect(r.available).toBe(-60);
    expect(r.potential).toBe(-60);
  });

  it("Pendente com decisão pay_as_overtime: NÃO entra em pending nem potential", () => {
    const r = computeBalance([
      mk({ status: "pending", minutes: 25, decision: "pay_as_overtime" }),
    ]);
    expect(r.pending).toBe(0);
    expect(r.potential).toBe(0);
  });

  it("Cancelled: ignorado em todos os campos", () => {
    const r = computeBalance([
      mk({ status: "cancelled", minutes: 999, effective_minutes: 999 }),
    ]);
    expect(r).toEqual({ approved: 0, pending: 0, paid: 0, rejected: 0, used: 0, available: 0, potential: 0 });
  });

  it("Sem movimentos: tudo a zero", () => {
    expect(computeBalance([])).toEqual({
      approved: 0, pending: 0, paid: 0, rejected: 0, used: 0, available: 0, potential: 0,
    });
  });
});

describe("computeMonthlyClosure — fecho mensal", () => {
  const credit = (mins: number, status: "approved" | "pending" = "approved"): MovementLike => ({
    source_type: "overtime",
    movement_type: "credit",
    minutes: mins,
    effective_minutes: status === "approved" ? mins : 0,
    status,
    decision: "credit_to_bank",
  });
  const debit = (mins: number): MovementLike => ({
    source_type: "compensation_used",
    movement_type: "debit",
    minutes: mins,
    effective_minutes: -mins,
    status: "approved",
    decision: "use_bank_hours",
  });

  it("C1 — transitar +5h", () => {
    const r = computeMonthlyClosure({
      opening: 0,
      movementsInMonth: [credit(300)],
      decision: "carry_over_all",
    });
    expect(r.balanceBeforeClosure).toBe(300);
    expect(r.paidOnClosure).toBe(0);
    expect(r.carriedOver).toBe(300);
    expect(r.closingBalance).toBe(300);
  });

  it("C2 — transitar -4h", () => {
    const r = computeMonthlyClosure({
      opening: 0,
      movementsInMonth: [debit(240)],
      decision: "carry_over_all",
    });
    expect(r.balanceBeforeClosure).toBe(-240);
    expect(r.carriedOver).toBe(-240);
  });

  it("C3 — negativo absorvido por créditos do mês seguinte", () => {
    const r = computeMonthlyClosure({
      opening: -240,
      movementsInMonth: [credit(120)],
      decision: "carry_over_all",
    });
    expect(r.balanceBeforeClosure).toBe(-120);
    expect(r.carriedOver).toBe(-120);
  });

  it("C4 — pagar tudo +3h", () => {
    const r = computeMonthlyClosure({
      opening: 0,
      movementsInMonth: [credit(180)],
      decision: "pay_all_and_zero",
    });
    expect(r.paidOnClosure).toBe(180);
    expect(r.carriedOver).toBe(0);
  });

  it("C5 — pagar parcial 5h de 10h", () => {
    const r = computeMonthlyClosure({
      opening: 0,
      movementsInMonth: [credit(600)],
      decision: "pay_partial",
      paidMinutes: 300,
      notes: "Pagamento parcial Fevereiro",
    });
    expect(r.paidOnClosure).toBe(300);
    expect(r.carriedOver).toBe(300);
  });

  it("C6 — tentar pagar 6h de 4h → erro", () => {
    expect(() =>
      computeMonthlyClosure({
        opening: 0,
        movementsInMonth: [credit(240)],
        decision: "pay_partial",
        paidMinutes: 360,
        notes: "ok",
      }),
    ).toThrow(/saldo disponível/);
  });

  it("C7 — pay_all_and_zero com saldo 0/negativo → erro", () => {
    expect(() =>
      computeMonthlyClosure({
        opening: 0,
        movementsInMonth: [debit(60)],
        decision: "pay_all_and_zero",
      }),
    ).toThrow(/saldo positivo/);
  });

  it("C8 — opening do mês seguinte = carried do anterior (chaining)", () => {
    const jan = computeMonthlyClosure({
      opening: 0,
      movementsInMonth: [credit(300)],
      decision: "carry_over_all",
    });
    const fev = computeMonthlyClosure({
      opening: jan.carriedOver,
      movementsInMonth: [credit(120)],
      decision: "carry_over_all",
    });
    expect(fev.balanceBeforeClosure).toBe(420);
    expect(fev.carriedOver).toBe(420);
  });

  it("pay_partial sem motivo → erro", () => {
    expect(() =>
      computeMonthlyClosure({
        opening: 0,
        movementsInMonth: [credit(600)],
        decision: "pay_partial",
        paidMinutes: 300,
      }),
    ).toThrow(/Motivo/);
  });

  it("ignora movimentos payout no agregado (anti-duplicação)", () => {
    const r = computeMonthlyClosure({
      opening: 0,
      movementsInMonth: [
        credit(300),
        {
          source_type: "payout",
          movement_type: "debit",
          minutes: 300,
          effective_minutes: -300,
          status: "paid",
          decision: "pay_as_overtime",
        },
      ],
      decision: "carry_over_all",
    });
    expect(r.approvedCredits).toBe(300);
    expect(r.paid).toBe(0);
    expect(r.balanceBeforeClosure).toBe(300);
  });
});

describe("computeMonthlyClosure — transição mensal (bug Helder)", () => {
  const credit = (mins: number): MovementLike => ({
    source_type: "overtime", movement_type: "credit",
    minutes: mins, effective_minutes: mins, status: "approved", decision: "credit_to_bank",
  });
  const debit = (mins: number): MovementLike => ({
    source_type: "compensation_used", movement_type: "debit",
    minutes: mins, effective_minutes: -mins, status: "approved", decision: "use_bank_hours",
  });

  it("T1 — saldo negativo transitado (-180) + débitos do mês (-535) = -715", () => {
    const r = computeMonthlyClosure({
      opening: -180,
      movementsInMonth: [debit(535)],
      decision: "carry_over_all",
    });
    expect(r.balanceBeforeClosure).toBe(-715);
    expect(r.carriedOver).toBe(-715);
  });

  it("T2 — saldo positivo transitado (300) + débito do mês (-120) = +180", () => {
    const r = computeMonthlyClosure({
      opening: 300,
      movementsInMonth: [debit(120)],
      decision: "carry_over_all",
    });
    expect(r.balanceBeforeClosure).toBe(180);
    expect(r.carriedOver).toBe(180);
  });

  it("T3 — saldo negativo (-180) abatido por crédito (+120) = -60", () => {
    const r = computeMonthlyClosure({
      opening: -180,
      movementsInMonth: [credit(120)],
      decision: "carry_over_all",
    });
    expect(r.balanceBeforeClosure).toBe(-60);
    expect(r.carriedOver).toBe(-60);
  });

  it("T4 — mês anterior não fechado COM movimentos prévios → bloqueia", () => {
    expect(() =>
      computeMonthlyClosure({
        opening: 0,
        movementsInMonth: [credit(120)],
        decision: "carry_over_all",
        previousMonthClosed: false,
        hasPriorMovements: true,
      }),
    ).toThrow(/mês anterior ainda não está fechado/i);
  });

  it("T4b — mês anterior não fechado SEM movimentos prévios → permite (bootstrap)", () => {
    const r = computeMonthlyClosure({
      opening: 0,
      movementsInMonth: [credit(120)],
      decision: "carry_over_all",
      previousMonthClosed: false,
      hasPriorMovements: false,
    });
    expect(r.carriedOver).toBe(120);
  });

  it("T5 — pagamento parcial com saldo transitado: 300 + 300 - 240 pagos = 360", () => {
    const r = computeMonthlyClosure({
      opening: 300,
      movementsInMonth: [credit(300)],
      decision: "pay_partial",
      paidMinutes: 240,
      notes: "Pagamento parcial maio",
    });
    expect(r.balanceBeforeClosure).toBe(600);
    expect(r.paidOnClosure).toBe(240);
    expect(r.carriedOver).toBe(360);
  });
});