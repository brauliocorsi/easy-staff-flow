# Fase 3 — Fecho Mensal do Banco de Horas

Etapa incremental sobre a Fase 2 (`time_bank_movements` + `computeBalance`). Não mexe na Fase 1 (`src/lib/timeClock.ts`), nem em férias coletivas, nem em créditos/débitos antigos. Saldo continua a vir EXCLUSIVAMENTE de movimentos auditáveis.

---

## 1. Base de dados — 1 migration

### Nova tabela `time_bank_monthly_closures`

```
id uuid pk
employee_id uuid
period_year int          -- ex.: 2026
period_month int         -- 1..12
opening_balance_minutes int        -- carried_over do mês anterior (0 se 1º fecho)
approved_credits_minutes int       -- Σ créditos approved do mês
approved_debits_minutes int        -- Σ |débitos approved| do mês (positivo)
paid_minutes int                   -- Σ minutes status='paid' do mês (excluindo o payout do fecho)
rejected_minutes int               -- Σ minutes status='rejected' do mês
pending_minutes_at_close int       -- pendências que afetariam banco no fim do mês
balance_before_closure_minutes int -- = opening + créditos − débitos do mês (antes do payout)
paid_on_closure_minutes int        -- valor pago neste fecho (0 se carry_over_all)
carried_over_minutes int           -- saldo que abre o mês seguinte (= closing_balance)
closing_balance_minutes int        -- saldo final após payout
closure_decision text              -- carry_over_all | pay_all_and_zero | pay_partial | manual_adjustment
closure_notes text                 -- motivo (obrigatório p/ pay_partial/manual_adjustment)
payout_movement_id uuid            -- FK lógica p/ time_bank_movements (nullable)
closed_by uuid
closed_at timestamptz
is_locked boolean default true
created_at / updated_at timestamptz
UNIQUE (employee_id, period_year, period_month)
```

CHECKs: `period_month BETWEEN 1 AND 12`, `closure_decision IN (...)`, `paid_on_closure_minutes >= 0`.
GRANTs: `authenticated` SELECT/INSERT/UPDATE; `service_role` ALL. RLS: Admin ALL; SELECT via `can_access_employee`.
Índices: `(employee_id, period_year, period_month)`, `(period_year, period_month)`.

### RPC `close_time_bank_month(_employee_id, _year, _month, _decision, _paid_minutes, _notes)`

`SECURITY DEFINER`, transacional. Substitui qualquer lógica client-side de fecho.

Passos:
1. Valida `auth.uid()` é admin.
2. Valida `_decision IN (carry_over_all, pay_all_and_zero, pay_partial, manual_adjustment)`.
3. `SELECT … FOR UPDATE` em qualquer linha existente para `(employee, year, month)`; se `is_locked=true` → erro "Mês já fechado".
4. Calcula `opening_balance` = `carried_over_minutes` do mês anterior (ou 0).
5. Agrega movimentos do mês `[first_day, last_day]`:
   - `approved_credits` = Σ `effective_minutes` onde `status='approved' AND movement_type='credit'`
   - `approved_debits`  = Σ `|effective_minutes|` onde `status='approved' AND movement_type='debit'` (excluindo qualquer payout de fecho — `source_type='payout'`)
   - `paid` / `rejected` / `pending` análogos a `computeBalance`
6. `balance_before_closure = opening + approved_credits − approved_debits`.
7. Valida regras:
   - `pay_all_and_zero`: só se `balance_before_closure > 0`; `paid_on_closure = balance_before_closure`.
   - `pay_partial`: exige `_paid_minutes > 0` e `<= balance_before_closure` (erro: "Não é possível pagar mais do que o saldo disponível"); exige `_notes`.
   - `carry_over_all`: `paid_on_closure = 0`.
   - `manual_adjustment`: exige `_notes`; `paid_on_closure = COALESCE(_paid_minutes,0)`; pode ser 0 (apenas regista decisão).
8. Se `paid_on_closure > 0`: insere movimento `payout` em `time_bank_movements`:
   - `source_type='payout'`, `movement_type='debit'`, `decision='pay_as_overtime'`
   - `minutes = paid_on_closure`, `effective_minutes = -paid_on_closure`
   - `status='paid'` (não conta para `approved` em `computeBalance`, conta para `paid`)
   - `record_date` = último dia do mês fechado
   - `description='Pagamento de horas extras no fecho mensal'`
   - `created_by = approved_by = auth.uid()`, `approved_at=now()`
9. `closing_balance = balance_before_closure − paid_on_closure`; `carried_over = closing_balance`.
10. UPSERT na `time_bank_monthly_closures` com `is_locked=true`, devolve a linha.

> **Nota anti-duplicação:** o movimento `payout` tem `status='paid'`. Em `computeBalance`, `paid` é informativo e NÃO entra em `approved`. Por isso o saldo do mês seguinte é controlado pelo `carried_over` (via opening balance da próxima closure) — não pelo movimento de pagamento. Isto evita contar duas vezes.

### RPC `reopen_time_bank_month(_closure_id)` (admin)
Marca `is_locked=false` e remove `payout_movement_id` (`status='cancelled'` no movimento, sem apagar). Mantém histórico.

---

## 2. Lógica (`src/lib/timeBank.ts`)

`computeBalance` permanece inalterada. Adiciona helpers puros:

```ts
export type ClosureDecision = 'carry_over_all' | 'pay_all_and_zero' | 'pay_partial' | 'manual_adjustment';
export function computeMonthlyClosure(opts: {
  opening: number;
  movementsInMonth: MovementLike[];      // exclui payout do próprio fecho
  decision: ClosureDecision;
  paidMinutes?: number;
}): {
  approvedCredits, approvedDebits, paid, rejected, pending,
  balanceBeforeClosure, paidOnClosure, carriedOver, closingBalance
}
```

Validações puras (lança `Error` PT-PT): "Não é possível pagar mais do que o saldo disponível", "Pagamento total exige saldo positivo", etc.

---

## 3. UI — nova aba "Fecho Mensal" em `OvertimeBank.tsx`

Novo ficheiro `src/components/timeclock/MonthlyClosureTab.tsx`:
- Selector de mês/ano + funcionário (admin) ou auto-filtrado.
- Tabela/preview com TODAS as linhas pedidas (saldo inicial, créditos, débitos, usadas, pagas, rejeitadas, pendências, saldo antes do fecho, decisão, valor pago, saldo transitado, saldo final, estado, quem fechou, data).
- Se `closing_balance > 0` e não fechado: Select "Destino do saldo positivo" com as 4 opções.
- `pay_partial` → Input minutos + preview do saldo transitado.
- `pay_all_and_zero` → AlertDialog com "Serão pagas Xh e o banco ficará a 0 para o próximo mês."
- Botão "Fechar mês" chama a RPC. Botão "Reabrir" (admin) chama a RPC de reabertura.

Atualização ao `OvertimeBank.tsx`:
- Nova tab "Fecho Mensal" ao lado de "Aprovações".
- Card de saldo passa a mostrar também `Saldo inicial do mês (transitado)` quando existir closure do mês anterior.

---

## 4. Testes — `src/lib/timeBank.test.ts`

Novos casos (sem quebrar os 11 existentes):

| # | Cenário | opening | créd | déb | decisão | paid | esperado |
|---|---|---:|---:|---:|---|---:|---|
| C1 | Transitar +5h | 0 | 300 | 0 | carry_over_all | — | carried=300, closing=300 |
| C2 | Transitar -4h | 0 | 0 | 240 | carry_over_all | — | carried=-240 |
| C3 | Negativo absorvido por créditos do mês seguinte | -240 | 120 | 0 | carry_over_all | — | balanceBefore=-120, carried=-120 |
| C4 | Pagar tudo +3h | 0 | 180 | 0 | pay_all_and_zero | — | paid=180, carried=0 |
| C5 | Pagar parcial 5h de 10h | 0 | 600 | 0 | pay_partial | 300 | paid=300, carried=300 |
| C6 | Tentar pagar 6h de 4h → throws | 0 | 240 | 0 | pay_partial | 360 | erro |
| C7 | pay_all_and_zero com saldo 0/negativo → throws | 0 | 0 | 60 | pay_all_and_zero | — | erro |
| C8 | Opening do mês seguinte = carried do anterior (helper de chaining) |

Todos os testes de `timeClock.test.ts`, `overtimeApprovals.test.ts` e `timeBank.test.ts` atuais continuam a passar.

---

## 5. Ficheiros

**Novos:**
- `supabase/migrations/<ts>_time_bank_monthly_closures.sql` (tabela + 2 RPCs)
- `src/components/timeclock/MonthlyClosureTab.tsx`

**Editados:**
- `src/lib/timeBank.ts` (+ `computeMonthlyClosure`, types)
- `src/lib/timeBank.test.ts` (+ 8 casos)
- `src/pages/OvertimeBank.tsx` (nova tab + saldo inicial visível)

**Intocados:** `src/lib/timeClock.ts`, edge functions, terminal, créditos/débitos antigos, férias coletivas.

---

## 6. Critérios de aceitação (mapeamento)

- ✅ Saldo transita via `carried_over_minutes` → opening do mês seguinte.
- ✅ Pagamento total/parcial cria movimento `payout` auditável (nunca edita créditos).
- ✅ `pay_partial > balance_before_closure` bloqueado na RPC e no UI.
- ✅ `pay_all_and_zero` exige saldo positivo.
- ✅ Pagamento aparece em "Horas Pagas" (via `paid` em `computeBalance`).
- ✅ Saldo negativo transita; créditos futuros reduzem-no por agregação no fecho seguinte.
- ✅ Fecho guarda `balance_before_closure`, `paid_on_closure`, `carried_over`, `closing_balance`.
- ✅ Reabertura cancela movimento (status `cancelled`), não apaga.

Confirmas para avançar com a migration de `time_bank_monthly_closures` + RPCs `close_time_bank_month` / `reopen_time_bank_month`?
