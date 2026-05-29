import { describe, it, expect } from "vitest";
import { splitBalance, type ApprovalLike } from "./overtimeApprovals";

describe("splitBalance — Fase 2 regra corrigida", () => {
  // Cenário base: 08:00 → 17:40, saída prevista 17:00, tolerância 15 min
  // → Fase 1 já creditou +25 min na diff diária.
  const dailyDiffSum = 25;

  it("Caso A — overtime não submetido: aprovado=0, pendente=+25, potencial=+25", () => {
    const approvals: ApprovalLike[] = [{ kind: "overtime", minutes: 25, status: "not_submitted" }];
    const r = splitBalance(dailyDiffSum, approvals);
    expect(r.approved).toBe(0);
    expect(r.pending).toBe(25);
    expect(r.rejected).toBe(0);
    expect(r.potential).toBe(25);
  });

  it("Caso A.bis — overtime pendente: igual ao not_submitted", () => {
    const r = splitBalance(dailyDiffSum, [{ kind: "overtime", minutes: 25, status: "pending" }]);
    expect(r).toEqual({ approved: 0, pending: 25, rejected: 0, potential: 25 });
  });

  it("Caso B — overtime aprovado: aprovado=+25, pendente=0, potencial=+25", () => {
    const r = splitBalance(dailyDiffSum, [{ kind: "overtime", minutes: 25, status: "approved" }]);
    expect(r).toEqual({ approved: 25, pending: 0, rejected: 0, potential: 25 });
  });

  it("Caso C — overtime rejeitado: aprovado=0, rejeitado=+25, potencial=0", () => {
    const r = splitBalance(dailyDiffSum, [{ kind: "overtime", minutes: 25, status: "rejected" }]);
    expect(r).toEqual({ approved: 0, pending: 0, rejected: 25, potential: 0 });
  });

  it("Caso D — trabalho em folga pendente: só em pendente e potencial", () => {
    const r = splitBalance(0, [{ kind: "day_off_work", minutes: 480, status: "pending" }]);
    expect(r).toEqual({ approved: 0, pending: 480, rejected: 0, potential: 480 });
  });

  it("Caso E — trabalho em folga aprovado: entra no aprovado e potencial", () => {
    const r = splitBalance(0, [{ kind: "day_off_work", minutes: 480, status: "approved" }]);
    expect(r).toEqual({ approved: 480, pending: 0, rejected: 0, potential: 480 });
  });

  it("Caso F — trabalho em folga rejeitado: aparece só como rejeitado", () => {
    const r = splitBalance(0, [{ kind: "day_off_work", minutes: 480, status: "rejected" }]);
    expect(r).toEqual({ approved: 0, pending: 0, rejected: 480, potential: 0 });
  });

  it("Caso G — trabalho em feriado pendente: só em pendente e potencial", () => {
    const r = splitBalance(0, [{ kind: "holiday_work", minutes: 480, status: "pending" }]);
    expect(r).toEqual({ approved: 0, pending: 480, rejected: 0, potential: 480 });
  });

  it("Caso H — trabalho em feriado rejeitado: aparece só como rejeitado", () => {
    const r = splitBalance(0, [{ kind: "holiday_work", minutes: 240, status: "rejected" }]);
    expect(r).toEqual({ approved: 0, pending: 0, rejected: 240, potential: 0 });
  });

  it("Sem candidatos: mantém a soma diária", () => {
    expect(splitBalance(120, [])).toEqual({ approved: 120, pending: 0, rejected: 0, potential: 120 });
    expect(splitBalance(-45, [])).toEqual({ approved: -45, pending: 0, rejected: 0, potential: -45 });
  });

  it("Mix: overtime pendente + trabalho em folga aprovado no mesmo período", () => {
    const r = splitBalance(25, [
      { kind: "overtime", minutes: 25, status: "pending" },
      { kind: "day_off_work", minutes: 480, status: "approved" },
    ]);
    // aprovado: 25 (Fase 1) - 25 (overtime pendente) + 480 (folga aprovada) = 480
    expect(r.approved).toBe(480);
    expect(r.pending).toBe(25);
    expect(r.rejected).toBe(0);
    expect(r.potential).toBe(505);
  });

  it("Mix: overtime rejeitado + feriado pendente", () => {
    const r = splitBalance(25, [
      { kind: "overtime", minutes: 25, status: "rejected" },
      { kind: "holiday_work", minutes: 240, status: "pending" },
    ]);
    expect(r.approved).toBe(0);
    expect(r.pending).toBe(240);
    expect(r.rejected).toBe(25);
    expect(r.potential).toBe(240);
  });
});