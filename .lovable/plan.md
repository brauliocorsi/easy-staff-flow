# Refatoração da Lógica de Ponto e Banco de Horas

Vou reconstruir o motor de ponto a partir do zero, centralizando toda a lógica em um único módulo confiável e adicionando detecção/sugestão automática de picagens em falta.

## Objetivos

1. **Janela de horário** — cada funcionário herda os horários do template (Fábrica, Escritório, etc.), com folgas e almoço.
2. **Validação consistente** — picagens são sempre mapeadas ao slot correto (entrada / saída almoço / retorno almoço / saída) usando a janela do horário, não a ordem bruta.
3. **Banco de horas mensal correto** — saldo acumulado dia-a-dia, com fechamento mensal claro (horas a mais / a menos no dia 31).
4. **Detecção e sugestão de picagens em falta** — se faltar uma picagem, o sistema sugere a hora correta no próximo registo e pede confirmação por PIN.
5. **Tolerâncias** — 10 min entrada / 15 min saída (extras só após 15 min).
6. **Meio-período automático** — se o funcionário só picar de manhã ou só de tarde, o sistema detecta e calcula apenas o período trabalhado (sem deficit do outro período se for marcado como ausência justificada/folga parcial).
7. **Folgas e férias respeitadas** — picagens em dia de folga ficam visualmente destacadas (badge "FOLGA"/"FÉRIAS") e não geram crédito/débito por defeito.

## Arquitetura

### Novo módulo central: `src/lib/timeClockEngine.ts`
Substitui o atual `src/lib/timeClock.ts`. Único ponto de verdade — usado por OvertimeBank, TimeClockReport, MonthlyExportDialog, DailyOverviewTable, EmployeeCard, edge functions.

**Funções principais:**

- `mapPunchesToSlots(record, schedule)` — mapeia as picagens ordenadas para os 4 slots (clock_in, lunch_out, lunch_in, clock_out) **usando proximidade ao horário esperado**, não à ordem dos campos da BD. Resolve casos como Ana Lucia (só tarde gravada nos campos da manhã).
- `detectMissingPunch(record, schedule, now)` — devolve `{ missing: 'lunch_out' | 'lunch_in' | ..., suggested_time }` quando uma picagem foi saltada. Usado pelo terminal para sugerir auto-correção.
- `calculateDayBalance(record, schedule, tolerances, absenceInfo)` — devolve `{ scheduled, worked, balance, status }` onde `status` ∈ `complete | half_day | day_off | vacation | absent | incomplete | extra_on_off`.
- `calculateMonthBalance(records, schedules, tolerances, absences, vacations, month)` — soma dia-a-dia respeitando folgas/férias/ausências, devolve saldo mensal final pronto para fecho.

**Regras de tolerância (fixas no engine, configuráveis por template):**
- Entrada tarde ≤ 10 min → sem débito
- Saída cedo ≤ 5 min → sem débito (mantém atual)
- Saída tarde ≤ 15 min → não conta como extra; > 15 min conta extra desde o minuto 0 acima do horário
- Retorno almoço tarde / saída almoço cedo seguem regras de entrada/saída

**Meio-período automático:**
- Só picagens da manhã (clock_in + lunch_out, sem lunch_in/clock_out) e o funcionário não picou até final do dia → marca como `half_day_morning`. O período da tarde só vira débito se NÃO houver ausência justificada/férias para a tarde.
- Inversamente para `half_day_afternoon`.

### Sugestão automática de picagem em falta
Atualizar `supabase/functions/time-clock-punch/index.ts`:

Quando o funcionário pica e o engine deteta um slot pulado (ex: entrou às 08:00, agora são 13:30 e não picou lunch_out nem lunch_in), o backend devolve:
```json
{
  "missing_punch_warning": true,
  "missing_slot": "lunch_out",
  "suggested_time": "12:00",
  "next_action": "lunch_in",
  "message": "Faltou registar a saída para almoço às 12:00. Confirma para preencher automaticamente?"
}
```
O terminal mostra modal com opções **Confirmar** / **Cancelar**. Ao confirmar, envia novo request com `confirm_missing_punch: true` e o backend grava ambas (a sugerida + a atual).

### Folgas / férias visualmente destacadas
- `EmployeeCard.tsx` e `DailyOverviewTable.tsx`: badge laranja "FOLGA" ou azul "FÉRIAS" quando aplicável; se houver picagem em dia de folga, ficar com borda destacada e tooltip "Picagem em dia de folga — não conta para banco de horas (a menos que aprovado como extra)".
- `OvertimeBank.tsx`: linhas de folga/férias com fundo cinzento, sem somar nada; coluna "Estado" mostra o tipo do dia.

### Fecho mensal (banco de horas)
Adicionar à página `OvertimeBank.tsx`:
- Card no topo: **Saldo do mês selecionado** (ex: "Abril/2026: +3h25 / -1h10 → Líquido: +2h15")
- Resumo por funcionário com colunas: Trabalhado / Programado / Extras / Débitos / Saldo final
- Botão "Fechar mês" (futuro — opcional) que congela o saldo na coluna `monthly_carryover`

## Mudanças por ficheiro

```text
NOVO  src/lib/timeClockEngine.ts          motor único
EDIT  src/pages/OvertimeBank.tsx          usa engine + cards mensais
EDIT  src/pages/TimeClockReport.tsx       usa engine
EDIT  src/components/timeclock/MonthlyExportDialog.tsx     usa engine
EDIT  src/components/timeclock/DailyOverviewTable.tsx      badges folga/férias
EDIT  src/components/timeclock/EmployeeCard.tsx            badges + alerta picagem em falta
EDIT  src/components/timeclock/TimeClockRecordDialog.tsx   usa engine para validar slots
EDIT  src/pages/TimeClock.tsx                              modal de confirmação picagem sugerida
EDIT  supabase/functions/time-clock-punch/index.ts         deteção + sugestão
DEL   src/lib/timeClock.ts                                 substituído
```

## Migração de dados
Não há mudança de schema. As picagens existentes continuam nos mesmos campos — o engine remapeia em runtime via `mapPunchesToSlots`, então cálculos passam a estar corretos sem alterar a BD.

## Validação
Após implementação, vou verificar manualmente:
- Ana Lucia 07/04 (caso só tarde) → deve mostrar meio-período tarde, sem débito da manhã se houver ausência, ou débito apenas da manhã.
- Funcionários com folga em dia com picagem → badge "FOLGA" e zero impacto no saldo.
- Funcionário que esqueceu lunch_out → ao picar lunch_in, terminal sugere "12:00 — confirmar?".
- Saldo mensal de um funcionário escolhido bate com soma manual.

Posso prosseguir?
