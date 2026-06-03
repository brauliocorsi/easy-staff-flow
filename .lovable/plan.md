## Plano

A Edge Function `detect-absences` **já faz** o que pediu: para uma data, ignora feriados, ignora dias de folga (via template de horário do funcionário), ignora férias aprovadas, e cria uma `absence` (`auto_detected=true`, `justified=false`) para quem não bateu ponto. Hoje corre só via cron (ontem). O que falta é dar-lhe interface, permitir confirmação posterior e mostrar férias gozadas no portal.

### 1. Detectar faltas — backfill manual (página Faltas)
- Adicionar botão **"Detectar Faltas"** no topo de `src/pages/Absences.tsx` (apenas admin).
- Abre dialog com seletor de intervalo de datas (default: últimos 7 dias).
- Ao confirmar, invoca `detect-absences` em loop dia-a-dia (a função já é idempotente — verifica `existingAbsences` antes de inserir).
- No fim mostra toast com total criado por dia e faz `invalidateQueries` das faltas.

### 2. Confirmação posterior pelo gestor
- Migration: adicionar coluna `admin_confirmed boolean default false` e `confirmed_at timestamptz` à tabela `absences`.
- Em `src/pages/Absences.tsx`, na linha de cada falta `auto_detected=true` e `justified=false`:
  - Mostrar badge "Pendente de confirmação" quando `admin_confirmed=false`.
  - Adicionar botão **"Confirmar falta"** (admin) que faz update `admin_confirmed=true, confirmed_at=now()`.
  - As ações existentes (Justificar, Converter para férias, Descontar do banco, Eliminar) continuam disponíveis.
- Novo cartão de estatística no topo: "A confirmar" = `auto_detected && !justified && !admin_confirmed`.

### 3. Férias gozadas no Portal do Funcionário
- Em `src/pages/EmployeePortal.tsx`, no cartão "Férias":
  - Adicionar resumo no topo da secção: **"X de Y dias gozados em {ano}"** (usando o `vacEnjoyed` e `vacEntitled` já calculados).
  - Listar separadamente as **gozadas** (com badge "Gozado" já existente) e as **futuras/pendentes**, ordenadas por data.
  - Mostrar contador total gozado no cabeçalho da secção (substituir `count={data.vacations.length}` por algo como `"3 gozadas · 5 marcadas"`).
- A flag `isVacationEnjoyed()` já trata isto (passado + collective vacations). Nada a alterar no `employee-portal` edge function — os dados já são enviados.

### Notas técnicas
- Não há necessidade de mexer em `detect-absences/index.ts` — a lógica de dias de trabalho/feriados/folgas já está completa e correta.
- A migration às `absences` é aditiva (default `false`); não quebra nada.
- Botão de detecção limita-se a no máximo 31 dias por chamada para evitar timeouts.
