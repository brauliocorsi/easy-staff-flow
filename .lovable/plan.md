

## Plano: Alerta visual de ponto pendente + Relatorio de registros

### 1. Card vermelho quando o ponto deveria ter sido picado

**Objetivo:** Quando o horario agendado de entrada ja passou e o funcionario ainda nao picou o ponto, o card aparece com borda/fundo vermelho como alerta visual.

**Alteracoes:**

**Edge Function `time-clock-employees`:**
- Alem do `schedule_label` e `today_status`, retornar tambem os horarios agendados do dia (`scheduled_clock_in`, `scheduled_lunch_out`, `scheduled_lunch_in`, `scheduled_clock_out`) e as tolerancias do template (`tolerance_late_minutes`).
- Isso permite ao frontend calcular se o funcionario esta atrasado.

**Componente `EmployeeCard.tsx`:**
- Receber os novos campos de horario agendado e tolerancia.
- Comparar a hora atual com o proximo horario esperado + tolerancia. Se ja passou e o ponto nao foi registrado, aplicar estilo vermelho:
  - Borda vermelha (`border-red-500`)
  - Badge "Atrasado" com icone de alerta
  - Fundo levemente vermelho (`bg-red-50`)
- A logica de "atrasado" considera: se `today_status === "clock_in"` e a hora atual > `scheduled_clock_in + tolerance_late_minutes`, marcar como atrasado. Mesma logica para lunch_out, lunch_in e clock_out.

**Interface `EmployeeData`:**
- Adicionar campos opcionais: `scheduled_clock_in`, `scheduled_lunch_out`, `scheduled_lunch_in`, `scheduled_clock_out`, `tolerance_late_minutes`.

---

### 2. Pagina de Relatorio de Registros de Ponto

**Objetivo:** Nova pagina `/relatorios/ponto` (protegida) com relatorio completo de registros de ponto por funcionario, por dia/semana, com contagem de horas trabalhadas.

**Nova pagina `src/pages/TimeClockReport.tsx`:**
- Filtros no topo:
  - Selecionar funcionario (dropdown com todos os ativos)
  - Periodo: dia, semana, mes (com date pickers)
- Tabela com colunas: Data, Entrada, Saida Almoco, Retorno Almoco, Saida, Total Horas, Status (atrasado/hora extra/normal)
- Calculo de horas: diferenca entre clock_out e clock_in, descontando tempo de almoco (lunch_out a lunch_in)
- Resumo na parte inferior:
  - Total de horas trabalhadas no periodo
  - Total de horas extras (quando clock_out > scheduled_clock_out + tolerance_overtime)
  - Total de atrasos
- Os dados sao buscados diretamente da tabela `time_clock_records` com join em `employees` e `schedule_templates`/`schedule_template_days`

**Rota e navegacao:**
- Adicionar rota `/relatorios/ponto` no `App.tsx`
- Adicionar link no sidebar (`AppSidebar.tsx`)

---

### Detalhes Tecnicos

**Arquivos a criar:**
- `src/pages/TimeClockReport.tsx` - pagina de relatorio

**Arquivos a modificar:**
- `supabase/functions/time-clock-employees/index.ts` - retornar horarios agendados e tolerancias
- `src/components/timeclock/EmployeeCard.tsx` - logica de card vermelho + estilos
- `src/components/timeclock/TodayStatus.tsx` - adicionar status "Atrasado"
- `src/App.tsx` - nova rota
- `src/components/layout/AppSidebar.tsx` - link para relatorio

**Calculo de horas trabalhadas:**
```text
horas_trabalhadas = (clock_out - clock_in) - (lunch_in - lunch_out)
horas_extras = max(0, clock_out - scheduled_clock_out - tolerance_overtime)
atraso = max(0, clock_in - scheduled_clock_in - tolerance_late)
```

**Sem alteracoes no banco de dados** - todos os dados necessarios ja existem nas tabelas `time_clock_records`, `schedule_templates` e `schedule_template_days`.

