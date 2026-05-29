# Conciliação Mensal do Ponto — Banco de Horas

Adicionar uma camada de **conciliação** entre o diagnóstico do ponto (`timeClock.ts` diff diário) e o banco oficial (`time_bank_movements`), preservando a regra de ouro: **o saldo oficial continua a vir exclusivamente de `time_bank_movements`**.

## Modelo

Dois novos `source_type` em `time_bank_movements`:

- `monthly_attendance_adjustment` — débito automático criado no fecho mensal a partir do diff negativo do ponto.
- `opening_balance_snapshot` — regularização inicial / histórica até uma data de corte.

Ambos são sempre `movement_type = 'debit'`, `status = 'approved'`, `decision = 'use_bank_hours'`, criados pelo admin. Positivos do ponto **nunca** geram movimento automático — continuam a passar por `overtime_approvals`.

## Idempotência

- Índice parcial único em `time_bank_movements`:
  - `(employee_id, record_date, source_type) WHERE source_type IN ('monthly_attendance_adjustment','opening_balance_snapshot') AND status <> 'cancelled'`
- Reabrir mês marca o movimento de conciliação como `cancelled` (igual padrão do payout), nunca apaga.

## RPCs novas/alteradas

1. **`compute_attendance_diff_minutes(_employee_id, _from, _to)`** (SQL helper)
   - Agrega o diff diário negativo dos registos de ponto fechados no intervalo, excluindo dias já cobertos por movimentos `monthly_attendance_adjustment` ativos. Usa a mesma lógica de `src/lib/timeClock.ts` portada para SQL — ou expomos o cálculo no cliente e passamos o total à RPC. **Decisão: calcular no cliente** (reusar `timeClock.ts`) e passar `_attendance_debit_minutes` à RPC, que apenas valida e cria o movimento. Mantém uma única fonte de verdade para a fórmula do diff.

2. **`close_time_bank_month(...)`** — adicionar parâmetro `_attendance_debit_minutes int default 0`:
   - Se `> 0` e ainda não existe `monthly_attendance_adjustment` ativo para `(employee, mês)`, cria movimento `debit` antes de agregar.
   - Re-agrega depois (o débito entra naturalmente em `approved_debits`).
   - Retorna `attendance_debit_created` no JSON.

3. **`create_opening_balance_snapshot(_employee_id, _cutoff_date, _minutes, _notes)`** — nova RPC admin:
   - Valida motivo obrigatório, `minutes > 0` (magnitude), bloqueia se já existir snapshot ativo para `(employee, cutoff_date)`.
   - Cria movimento `opening_balance_snapshot` (debit) com `record_date = cutoff_date`.

4. **`reopen_time_bank_month`** — estender para cancelar também o `monthly_attendance_adjustment` do mês.

## Frontend

### `src/lib/timeBank.ts`
- `computeMonthlyClosure` aceita `attendanceDebitMinutes?: number` e cria entrada virtual de débito antes de calcular `balanceBeforeClosure` (apenas para preview). Adiciona campo `attendanceDebitProposed` no resultado.

### `src/lib/attendanceReconciliation.ts` (novo)
- `computeAttendanceDebitForMonth(employeeId, year, month)`: usa `timeClock.ts` para somar diff negativo dos dias do mês, subtrai débitos já lançados.
- Função pura, testável.

### `src/components/timeclock/MonthlyClosureTab.tsx`
- Novo bloco **"Conciliação do ponto"** acima das decisões:
  - Diferença do ponto no mês (em horas)
  - Débitos já lançados
  - Valor a conciliar (proposta)
  - Pendências positivas a aguardar aprovação (contagem)
  - Checkbox/aviso: "Lançar débito de Xh no fecho"
- Se houver valor a conciliar e admin não confirmar, mostrar warning bloqueante.
- Botão **"Criar regularização inicial"** num modal separado (data de corte + motivo + minutos).

## Testes (`src/lib/timeBank.test.ts` + novo `attendanceReconciliation.test.ts`)

1. `computeMonthlyClosure` com `attendanceDebitMinutes = 535` e opening 0 → balanceBefore = -535.
2. Conciliação não duplica: já existe débito → proposta = 0.
3. Diff positivo do ponto → proposta = 0 (não gera nada).
4. Cenário Helder: abril -180, maio -535, junho abre com -715.
5. Regularização inicial: -180, cria, segunda tentativa bloqueia.

## Migration

```sql
-- novo índice parcial
CREATE UNIQUE INDEX time_bank_movements_unique_reconciliation
  ON public.time_bank_movements(employee_id, record_date, source_type)
  WHERE source_type IN ('monthly_attendance_adjustment','opening_balance_snapshot')
    AND status <> 'cancelled';

-- update close_time_bank_month (novo parâmetro)
-- update reopen_time_bank_month (cancelar adjustment)
-- nova create_opening_balance_snapshot
```

## Fora de scope
- Não alterar `timeClock.ts` (apenas consumir).
- Não tocar em férias coletivas.
- Não alterar fluxo de positivos / `overtime_approvals`.

Posso avançar?
