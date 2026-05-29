import { describe, it, expect } from "vitest";
import { computeBalance, type MovementLike } from "./timeBank";

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