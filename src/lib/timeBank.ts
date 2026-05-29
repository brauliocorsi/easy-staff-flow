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
  | "correction";
// Note: `compensatory_rest` is a DECISION (destination), never a source_type.

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

// =============================================================================
// Fase 3 — Fecho Mensal do Banco de Horas
// =============================================================================

export type ClosureDecision =
  | "carry_over_all"
  | "pay_all_and_zero"
  | "pay_partial"
  | "manual_adjustment";

export type MonthlyClosureInput = {
  /** Saldo transitado do mês anterior (em minutos, com sinal). */
  opening: number;
  /** Movimentos do mês — exclui qualquer payout do próprio fecho. */
  movementsInMonth: MovementLike[];
  decision: ClosureDecision;
  /** Minutos a pagar (obrigatório para pay_partial, opcional para manual_adjustment). */
  paidMinutes?: number;
  /** Motivo (obrigatório para pay_partial e manual_adjustment). */
  notes?: string | null;
};

export type MonthlyClosureResult = {
  approvedCredits: number;
  approvedDebits: number;
  paid: number;
  rejected: number;
  pending: number;
  balanceBeforeClosure: number;
  paidOnClosure: number;
  carriedOver: number;
  closingBalance: number;
};

/**
 * Calcula um fecho mensal de banco de horas a partir do saldo transitado
 * (`opening`) e dos movimentos do mês. Não toca em nenhum movimento existente —
 * o pagamento é registado como um novo movimento `payout` pela RPC do servidor.
 *
 * Lança Error PT-PT quando as regras são violadas.
 */
export function computeMonthlyClosure(opts: MonthlyClosureInput): MonthlyClosureResult {
  // Exclui qualquer movimento de payout para evitar dupla contagem (são pagamentos
  // do próprio fecho e devem ser registados separadamente).
  const movs = opts.movementsInMonth.filter((m) => m.source_type !== "payout");

  let approvedCredits = 0;
  let approvedDebits = 0;
  let paid = 0;
  let rejected = 0;
  let pending = 0;

  for (const m of movs) {
    switch (m.status) {
      case "approved":
        if (m.movement_type === "credit") approvedCredits += m.effective_minutes;
        else if (m.movement_type === "debit") approvedDebits += Math.abs(m.effective_minutes);
        break;
      case "pending":
        if (PENDING_AFFECTS_BANK.has(m.decision ?? null)) pending += m.minutes;
        break;
      case "paid":
        paid += m.minutes;
        break;
      case "rejected":
        rejected += m.minutes;
        break;
      default:
        break;
    }
  }

  const balanceBeforeClosure = opts.opening + approvedCredits - approvedDebits;

  let paidOnClosure = 0;
  switch (opts.decision) {
    case "carry_over_all":
      paidOnClosure = 0;
      break;
    case "pay_all_and_zero":
      if (balanceBeforeClosure <= 0) {
        throw new Error("Pagamento total exige saldo positivo");
      }
      paidOnClosure = balanceBeforeClosure;
      break;
    case "pay_partial": {
      const requested = opts.paidMinutes ?? 0;
      if (requested <= 0) throw new Error("Indica as horas a pagar");
      if (requested > balanceBeforeClosure) {
        throw new Error("Não é possível pagar mais do que o saldo disponível");
      }
      if (!opts.notes || opts.notes.trim().length === 0) {
        throw new Error("Motivo obrigatório para pagamento parcial");
      }
      paidOnClosure = requested;
      break;
    }
    case "manual_adjustment": {
      if (!opts.notes || opts.notes.trim().length === 0) {
        throw new Error("Motivo obrigatório para ajuste manual");
      }
      const requested = Math.max(0, opts.paidMinutes ?? 0);
      if (requested > balanceBeforeClosure) {
        throw new Error("Não é possível pagar mais do que o saldo disponível");
      }
      paidOnClosure = requested;
      break;
    }
  }

  const closingBalance = balanceBeforeClosure - paidOnClosure;

  return {
    approvedCredits,
    approvedDebits,
    paid,
    rejected,
    pending,
    balanceBeforeClosure,
    paidOnClosure,
    carriedOver: closingBalance,
    closingBalance,
  };
}

export function closureDecisionLabel(decision: ClosureDecision): string {
  switch (decision) {
    case "carry_over_all":
      return "Transitar tudo para o próximo mês";
    case "pay_all_and_zero":
      return "Pagar tudo e zerar banco";
    case "pay_partial":
      return "Pagar parcialmente";
    case "manual_adjustment":
      return "Ajuste manual";
  }
}