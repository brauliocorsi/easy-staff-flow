# Fase 2 (revista) — Banco de Horas como conta-corrente

Mantém a Fase 1 (`src/lib/timeClock.ts`) intocada. A diff diária continua a ser o **indicador do que aconteceu**, mas **deixa de ser** a base do saldo aprovado. O saldo oficial passa a ser calculado **exclusivamente** a partir de movimentos auditáveis em `time_bank_movements`.

A tabela `overtime_approvals` (já criada) é mantida como **fila de pendências** (o que aconteceu e aguarda decisão). A nova tabela `time_bank_movements` é a **conta-corrente** (o que a gerência decidiu).

---

## 1. Base de dados (1 nova migration)

### Nova tabela `time_bank_movements`

```
id uuid pk
employee_id uuid
record_date date
source_type text   -- overtime | day_off_work | holiday_work | manual_adjustment
                   -- compensation_used | absence_compensation | payout | correction
source_id uuid     -- id da aprovação/registo relacionado (opcional)
movement_type text -- credit | debit | neutral
minutes int        -- sempre positivo
effective_minutes int -- com sinal (+credit / -debit / 0 neutral)
decision text      -- credit_to_bank | pay_as_overtime | compensatory_rest
                   -- offset_negative_balance | reject | use_bank_hours
status text        -- pending | approved | rejected | paid | cancelled
description text
created_by uuid
approved_by uuid
created_at / approved_at timestamptz
```

CHECK: `source_type`, `movement_type`, `decision`, `status` restritos por listas.
GRANTs + RLS: Admin ALL; SELECT via `can_access_employee`.
Índices: `(employee_id, record_date)`, `(status)`, `(source_type, source_id)`.

### Ajuste à `overtime_approvals`

Adicionar coluna `decision text` (nullable) — guarda a decisão da gerência ao aprovar (`credit_to_bank | pay_as_overtime | compensatory_rest | offset_negative_balance | reject`). O `status` continua `pending/approved/rejected`; `decision` é exigida quando `status='approved'`.

Sem alterar `time_adjustment_logs` nem `time_clock_records`.

---

## 2. Lógica de saldo (`src/lib/timeBank.ts`, novo)

Função pura `computeBalance(movements)` que devolve:

```ts
{
  approved,        // Σ effective_minutes de status='approved' (créditos + débitos)
  pending,         // Σ minutes de status='pending' que afectariam o banco
                   //  (decision ausente ou ∈ {credit_to_bank, offset_negative_balance})
  paid,            // Σ minutes de status='paid' (informativo)
  rejected,        // Σ minutes de status='rejected' (informativo)
  used,            // Σ |effective_minutes| de débitos aprovados (compensation_used, absence_compensation)
  available,       // = approved   (sinónimo claro para UI)
  potential,       // = approved + pending
}
```

**Regra anti-duplicação (em comentários no código):** a diff de Fase 1 já inclui overtime após tolerância, mas o saldo do banco **NÃO** consome essa diff. O saldo só conta movimentos. Assim:
- overtime pendente → 0 no `approved`, +X em `pending`
- overtime `pay_as_overtime` → 0 no `approved`, +X em `paid`
- overtime `credit_to_bank` aprovado → +X em `approved`
- overtime rejeitado → 0 no `approved`, +X em `rejected`
- débito aprovado (uso de banco) → -X em `approved`, +X em `used`

`splitBalance` legado em `overtimeApprovals.ts` fica marcado `@deprecated` e o `OvertimeBank.tsx` passa a usar `computeBalance`. Testes antigos não se quebram (continuam a validar a função pura sobre a estrutura ApprovalLike), mas o painel deixa de a usar.

---

## 3. Fluxo de aprovação

`OvertimeApprovalsTab.tsx` (criar) — tabela de `overtime_approvals` com filtros.

Ao aprovar/rejeitar abre dialog com:
- **Destino das horas** (Select obrigatório):
  - Creditar no Banco de Horas → `decision=credit_to_bank` + insere movimento `credit` aprovado
  - Pagar como Hora Extra → `decision=pay_as_overtime` + movimento `neutral`, `status=paid`
  - Converter em Descanso Compensatório → `decision=compensatory_rest` + movimento `credit` aprovado com `source_type=compensatory_rest` (identificável)
  - Usar para Abater Saldo Negativo → `decision=offset_negative_balance` + movimento `credit` aprovado (matematicamente igual a credit_to_bank, mas rotulado)
  - Rejeitar → `status=rejected`, sem movimento (ou movimento `neutral` rejeitado para rasto)
- **Nota/motivo** (`review_notes`).

Tudo numa transação client-side (insert movement → update approval) com rollback em erro.

---

## 4. Uso de banco pelo funcionário (débito)

Novo dialog "Usar banco de horas" em `OvertimeBank.tsx` (admin):
- Funcionário, data, minutos, motivo obrigatório, source_type (`compensation_used` / `absence_compensation`).
- Cria movimento `debit`, `effective_minutes = -X`, `status='approved'` (admin) ou `pending` (futuro auto-serviço).

---

## 5. UI — `OvertimeBank.tsx`

Cartão "Saldo Acumulado" passa a 7 linhas:
```
Saldo aprovado:    +Xh
Horas pendentes:   +Xh
Horas pagas:       +Xh
Horas rejeitadas:  +Xh
Horas usadas:      -Xh
Saldo disponível:  +Xh   (= aprovado)
Saldo potencial:   +Xh   (= aprovado + pendentes)
```
Rótulo principal (favor/dever/equilibrado) baseado em **saldo disponível**.

Cards admin no topo: pendentes overtime / folga / feriado / correções manuais / picagens incompletas (contagem de `overtime_approvals.status='pending'` por `kind` + `time_adjustment_logs` recentes).

Badges PT-PT: Pendente de Aprovação · Creditado no Banco · Pago como Hora Extra · Convertido em Descanso · Usado para Abater Saldo Negativo · Banco Usado pelo Funcionário · Rejeitado · Cancelado.

---

## 6. Detecção de pendências (já existe)

`detectOvertimeCandidate` / `detectExceptionalWork` em `overtimeApprovals.ts` continuam a ser usados — geram inserts em `overtime_approvals` (status=pending). Sem auto-credit.

---

## 7. Testes (`src/lib/timeBank.test.ts`, novo)

Casos 1–8 do pedido, mais mix:

| Caso | Movimentos | approved | pending | paid | rejected | used | available | potential |
|------|-----------|---------:|--------:|-----:|---------:|-----:|----------:|----------:|
| 1 — overtime pendente (25) | 1 pending credit_to_bank | 0 | 25 | 0 | 0 | 0 | 0 | 25 |
| 2 — creditada no banco | 1 approved credit | 25 | 0 | 0 | 0 | 0 | 25 | 25 |
| 3 — paga | 1 paid neutral | 0 | 0 | 25 | 0 | 0 | 0 | 0 |
| 4 — rejeitada | 1 rejected | 0 | 0 | 0 | 25 | 0 | 0 | 0 |
| 5 — feriado 8h pendente | 1 pending holiday | 0 | 480 | 0 | 0 | 0 | 0 | 480 |
| 6 — folga 6h pendente | 1 pending day_off | 0 | 360 | 0 | 0 | 0 | 0 | 360 |
| 7 — uso de banco | +360 approved, -120 approved debit | 240 | 0 | 0 | 0 | 120 | 240 | 240 |
| 8 — abater negativo | prev -180 (manual), +120 approved | -60 | 0 | 0 | 0 | 0 | -60 | -60 |

Manter `overtimeApprovals.test.ts` a passar (função `splitBalance` mantida e marcada deprecated).

---

## 8. Ficheiros

**Novos:**
- `supabase/migrations/<ts>_time_bank_movements.sql`
- `src/lib/timeBank.ts` + `src/lib/timeBank.test.ts`
- `src/components/timeclock/OvertimeApprovalsTab.tsx`
- `src/components/timeclock/ApproveOvertimeDialog.tsx` (destino + motivo)
- `src/components/timeclock/UseBankHoursDialog.tsx` (débito manual admin)
- `src/components/timeclock/AdjustmentLogList.tsx`

**Editados:**
- `src/pages/OvertimeBank.tsx` — passa a usar `computeBalance` + nova UI
- `src/components/timeclock/TimeClockRecordDialog.tsx` — motivo obrigatório + log

**Intocados:** `src/lib/timeClock.ts`, edge functions, terminal, `splitBalance` mantido como deprecated.

---

Confirmas para avançar com a migration de `time_bank_movements` + coluna `decision`?
