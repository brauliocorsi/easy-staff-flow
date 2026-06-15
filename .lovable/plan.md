## Problema

Na página Banco de Horas (e no Portal do Colaborador), o "Saldo Acumulado" / "Saldo Transitado" do mês corrente está a somar, em cima do carry do último fecho, o cálculo ao vivo do mês atual. Esse cálculo trata o **dia de hoje ainda em curso** como déficit total (faltam picagens), inflando o valor.

Exemplo (Maria do Céu, 15/06/2026):
- Fecho de 05/2026 → carried_over = -240 (-4h) ✅
- Sem movimentos em 06/2026
- Hoje (15/06) tem clock_in + lunch_out mas ainda sem clock_out → `calculateWorkday` devolve ~ -240 min
- UI calcula: -240 (transitado) + -240 (live month) = **-480 (-8:00)** ❌

A regra de saldo continua correta; só o "live month" precisa ignorar o dia em aberto.

## Mudanças

### 1. `src/pages/OvertimeBank.tsx`
No memo `summaryPerEmployee`, ao iterar os dias do mês corrente para `attendanceMonthByEmp`:
- Continuar a saltar `dateStr > today` (já existe).
- **Saltar também `dateStr === today`** quando estamos no mês corrente (`isCurrentMonth`). A justificação: o dia em curso ainda não fechou; não deve gerar débito até ao final do expediente. (Outros dias incompletos passados continuam a contar como hoje — só o "hoje" é excluído.)

Isto mantém:
- "Saldo do Mês" e "Saldo Acumulado" coerentes (ambos passam a ignorar o dia em curso).
- Coerência com o que admin vê quando comparado ao histórico do colaborador.

### 2. `supabase/functions/employee-portal/index.ts`
Já calcula `timeBankAccumulatedMinutes` como `lastClosure.carried_over + approved movements after cutoff`. Esta parte **não** inclui live-month, então o portal já mostra apenas o saldo oficial. Verificar que o número do portal para Maria do Céu hoje é **-240 (-4:00)**, batendo com o carry oficial. Sem alteração necessária ali a menos que se confirme divergência.

### 3. Verificação
- `bun run typecheck`
- Abrir `/banco-horas` com mês = Junho/2026, confirmar:
  - Maria do Céu: Saldo do Mês = 0:00 (ou o que for sem contar hoje), Saldo Acumulado = -4:00.
- Confirmar que dias passados incompletos (ex.: 13/06) continuam a contar como déficit (não foram afetados).

## Fora de escopo

- Não alterar regras de cálculo do banco (`calculateWorkday`, tolerâncias, fecho mensal).
- Não alterar a função `close_time_bank_month` nem movimentos existentes.
- Não tocar nas RLS nem em queries de outros funcionários.
