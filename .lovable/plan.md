# Fase 2 — Aprovações e Auditoria do Banco de Horas (regra de saldo corrigida)

Sem alterar a Fase 1 (`src/lib/timeClock.ts`). Sem férias coletivas. Tolerâncias continuam vindas de `schedule_templates` / `employee_schedules`.

---

## 1. Regra de cálculo do saldo (CORRIGIDA)

**Premissa crítica:** a `diff` diária da Fase 1 **já inclui o crédito de overtime após tolerância**. Logo, no saldo aprovado temos de **subtrair** o overtime que não esteja aprovado.

### Função pura `splitBalance(dailyDiffSum, approvals)` em `src/lib/overtimeApprovals.ts`

```ts
type Status = "approved" | "pending" | "not_submitted" | "rejected";
type Kind = "overtime" | "day_off_work" | "holiday_work";

function splitBalance(dailyDiffSum: number, approvals: { kind: Kind; minutes: number; status: Status }[]) {
  let approved = dailyDiffSum;   // base já contém overtime creditado pela Fase 1
  let pending = 0;
  let rejected = 0;

  for (const a of approvals) {
    const isPending = a.status === "pending" || a.status === "not_submitted";

    if (a.kind === "overtime") {
      // Fase 1 já creditou estes minutos.
      if (a.status === "approved") {
        // mantém em approved (já incluído em dailyDiffSum)
      } else if (isPending) {
        approved -= a.minutes;   // remove do oficial
        pending  += a.minutes;   // mostra como pendente
      } else if (a.status === "rejected") {
        approved -= a.minutes;   // remove do oficial
        rejected += a.minutes;   // informativo apenas
      }
    } else {
      // day_off_work | holiday_work — Fase 1 NÃO credita
      if (a.status === "approved") {
        approved += a.minutes;
      } else if (isPending) {
        pending  += a.minutes;
      }
      // rejected: ignora (não entra em approved, pending nem potential)
    }
  }

  return { approved, pending, rejected, potential: approved + pending };
}
```

### Resultados garantidos (`src/lib/overtimeApprovals.test.ts`)

| Caso | Fase 1 diff | Tipo | Estado | Approved | Pending | Rejected | Potential |
|------|------------:|------|--------|---------:|--------:|---------:|----------:|
| A — 08:00→17:40, sem aprovar | +25 | overtime | not_submitted | **0** | **+25** | 0 | **+25** |
| B — mesmo, aprovado          | +25 | overtime | approved      | **+25** | 0 | 0 | **+25** |
| C — mesmo, rejeitado         | +25 | overtime | rejected      | **0** | 0 | **+25** | **0** |
| D — folga 8h, pendente       | 0 | day_off_work | pending  | 0 | **480** | 0 | **480** |
| E — folga 8h, aprovado       | 0 | day_off_work | approved | **480** | 0 | 0 | **480** |
| F — folga 8h, rejeitado      | 0 | day_off_work | rejected | **0** | 0 | 0 | **0** |
| G — feriado 8h, pendente     | 0 | holiday_work | pending | 0 | **480** | 0 | **480** |

Extra:
- Sem candidatos → approved = dailyDiffSum; pending=rejected=0; potential=approved.
- Mix overtime pending + day_off approved no mesmo mês: somam-se correctamente.

---

## 2. Base de dados (1 migration)

### `overtime_approvals`
- `id`, `employee_id`, `record_date`
- `kind`: `overtime | day_off_work | holiday_work`
- `minutes` (int > 0)
- `tolerance_applied_minutes` (int)
- `scheduled_clock_out`, `actual_clock_in`, `actual_clock_out` (snapshot)
- `status`: `pending | approved | rejected` (default `pending`)
- `reviewed_by`, `reviewed_at`, `review_notes`, `time_clock_record_id`
- UNIQUE `(employee_id, record_date, kind)`
- GRANTs + RLS: Admin ALL; SELECT via `can_access_employee`.

### `time_adjustment_logs` (imutável)
- `id`, `time_clock_record_id`, `employee_id`, `record_date`
- `field`: `clock_in | lunch_out | lunch_in | clock_out`
- `adjustment_type`: `add | edit | remove`
- `previous_value`, `new_value`, `reason` (NOT NULL)
- `requested_by`, `approved_by`, `status` (default `approved` para edição directa de admin)
- GRANTs + RLS: Admin INSERT/SELECT; SELECT via `can_access_employee`. Sem UPDATE/DELETE.

**Nota:** `not_submitted` é só estado lógico no frontend (candidato detectado sem linha em `overtime_approvals`). Não existe na BD.

---

## 3. Frontend

- `src/lib/overtimeApprovals.ts` (puro): `detectOvertimeCandidate`, `detectExceptionalWork`, `splitBalance`.
- `src/pages/OvertimeBank.tsx`:
  - Cartão "Saldo Acumulado" passa a 4 linhas: **Aprovado / Pendente / Rejeitado / Potencial**. Rótulo "A favor / A dever / Equilibrado" baseado no **Aprovado**.
  - Cards topo (admin): pendentes de overtime, folga, feriado, correções manuais, picagens incompletas.
- `src/components/timeclock/OvertimeApprovalsTab.tsx`: tabela com filtros + acções Aprovar/Rejeitar (com `review_notes`).
- `src/components/timeclock/AdjustmentLogList.tsx`: histórico por registo.
- `src/components/timeclock/TimeClockRecordDialog.tsx`: campo **Motivo** obrigatório + insert em `time_adjustment_logs` antes do update; lista de histórico.

Badges PT-PT: Pendente de Aprovação / Aprovado / Rejeitado / Hora Extra / Trabalho em Feriado / Trabalho em Dia de Folga / Correção Manual / Picagem Incompleta.

---

## 4. Ficheiros

**Novos:**
- `supabase/migrations/<ts>_phase2_overtime_approvals.sql`
- `src/lib/overtimeApprovals.ts`
- `src/lib/overtimeApprovals.test.ts`
- `src/components/timeclock/OvertimeApprovalsTab.tsx`
- `src/components/timeclock/AdjustmentLogList.tsx`

**Editados:**
- `src/pages/OvertimeBank.tsx`
- `src/components/timeclock/TimeClockRecordDialog.tsx`

**Intocados:** `src/lib/timeClock.ts`, edge functions, terminal, RLS de outras tabelas.

Confirmas para criar a migration e implementar?