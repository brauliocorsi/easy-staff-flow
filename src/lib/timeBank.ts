/**
 * Banco de Horas — Conta Corrente (Fase 2 revista)
 *
 * IMPORTANT — ANTI-DUPLICATION RULE:
 * The Fase 1 daily diff (`src/lib/timeClock.ts`) already credits overtime
 * minutes beyond the tolerance into the diff. However the OFFICIAL bank
 * balance does NOT consume that diff anymore: it is built EXCLUSIVELY from
 * approved movements in `time_bank_movements`. The diff is now informative.
 *
 * Each pending/approved/rejected/paid overtime, day-off work, holiday work,
 * manual adjustment, compensation, payout or correction generates a movement
 * row. `computeBalance()` aggregates those rows.
 */

export type MovementStatus = "pending" | "approved" | "rejected" | "paid" | "cancelled";
export type MovementType = "credit" | "debit" | "neutral";
export type MovementDecision =
  | "credit_to_bank"
  | "pay_as_overtime"
  | "compensatory_rest"
  | "offset_negative_balance"
  | "reject"
  | "use_bank_hours"
  | null
  | undefined;

export type MovementSourceType =
  | "overtime"
  | "day_off_work"
  | "holiday_work"
  | "manual_adjustment"
  | "compensation_used"
  | "absence_compensation"
  | "payout"
  | "correction"
  | "compensatory_rest";

export type MovementLike = {
  source_type: MovementSourceType;
  movement_type: MovementType;
  minutes: number;            // always positive magnitude
  effective_minutes: number;  // signed (credit +, debit -, neutral 0)
  decision?: MovementDecision;
  status: MovementStatus;
};

export type BankBalance = {
  /** Officially approved minutes (credits − debits). */
  approved: number;
  /** Pending minutes that COULD become a credit (informative). */
  pending: number;
  /** Minutes paid as overtime — never in the bank (informative). */
  paid: number;
  /** Minutes rejected — never in the bank (informative). */
  rejected: number;
  /** Absolute minutes of approved debits (informative). */
  used: number;
  /** Synonym of `approved`, surfaced as "Saldo Disponível". */
  available: number;
  /** approved + pending. */
  potential: number;
};

/** Decisions whose pending status would credit the bank if approved. */
const PENDING_AFFECTS_BANK = new Set<MovementDecision>([
  null,
  undefined,
  "credit_to_bank",
  "offset_negative_balance",
  "compensatory_rest",
]);

export function computeBalance(movements: MovementLike[]): BankBalance {
  let approved = 0;
  let pending = 0;
  let paid = 0;
  let rejected = 0;
  let used = 0;

  for (const m of movements) {
    switch (m.status) {
      case "approved":
        // credits add (+), debits subtract (−), neutrals are 0
        approved += m.effective_minutes;
        if (m.movement_type === "debit") used += m.minutes;
        break;
      case "pending":
        if (PENDING_AFFECTS_BANK.has(m.decision ?? null)) {
          pending += m.minutes;
        }
        break;
      case "paid":
        paid += m.minutes;
        break;
      case "rejected":
        rejected += m.minutes;
        break;
      case "cancelled":
      default:
        break;
    }
  }

  return {
    approved,
    pending,
    paid,
    rejected,
    used,
    available: approved,
    potential: approved + pending,
  };
}

/** Maps the DB decision to a human-readable PT-PT badge label. */
export function decisionLabel(decision: MovementDecision, status: MovementStatus): string {
  if (status === "pending") return "Pendente de Aprovação";
  if (status === "rejected") return "Rejeitado";
  if (status === "cancelled") return "Cancelado";
  if (status === "paid") return "Pago como Hora Extra";
  switch (decision) {
    case "credit_to_bank":
      return "Creditado no Banco";
    case "compensatory_rest":
      return "Convertido em Descanso";
    case "offset_negative_balance":
      return "Usado para Abater Saldo Negativo";
    case "use_bank_hours":
      return "Banco Usado pelo Funcionário";
    case "pay_as_overtime":
      return "Pago como Hora Extra";
    default:
      return "Aprovado";
  }
}