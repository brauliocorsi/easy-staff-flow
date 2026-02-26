

## Plano: Ferias com Multiplos Periodos por Colaborador

### Problema Atual

O sistema atual permite apenas um periodo continuo de ferias por pedido (data inicio - data fim). Na realidade, os colaboradores dividem as ferias em varios periodos ao longo do ano (ex: 1 dia em fevereiro, 2 em agosto, 15 em setembro). Alem disso, as ferias coletivas nao ficam registadas como pedidos individuais de cada colaborador.

---

### 1. Formulario de Ferias com Multiplos Periodos (VacationFormDialog)

Reescrever o formulario para permitir adicionar varios periodos antes de submeter:

- Selecionar funcionario e dias de direito (como agora)
- Adicionar periodos: botao "+ Adicionar Periodo" que mostra pares de data inicio/fim
- Lista dos periodos adicionados com contagem de dias uteis e botao de remover
- Totalizador: soma de dias de todos os periodos vs dias de direito
- Ao submeter: cria um `vacation_request` por cada periodo (todos com o mesmo employee_id, year, category)
- Envia um unico e-mail ao funcionario com link para confirmar/sugerir alteracoes

---

### 2. Pagina de Ferias Agrupada por Colaborador (Vacations.tsx)

Na aba Individual, agrupar os pedidos por colaborador:

- Cada linha principal mostra: nome do colaborador, total de dias aprovados/pendentes, total de dias de direito, status geral
- Ao expandir (accordion/collapsible), mostra todos os periodos desse colaborador com datas, dias, status e acoes individuais
- Acoes por colaborador: aprovar todos, reenviar e-mail
- Acoes por periodo: marcar como gozada, aprovar individualmente, eliminar

---

### 3. Pagina Publica com Multiplos Periodos (VacationPublic.tsx)

Reescrever para o colaborador poder sugerir varios periodos:

- Mostrar dias de direito e periodos ja definidos pelo RH
- Botao "+ Adicionar Periodo" com selecao de data inicio/fim para cada
- Lista dos periodos com totalizador de dias
- Validacao: soma dos dias nao pode exceder dias de direito
- Ao submeter: atualiza os periodos existentes ou cria novos via edge function

---

### 4. Ferias Coletivas Registadas por Colaborador (CollectiveVacationForm)

Quando o admin guarda o periodo coletivo:

- Alem de guardar em `vacation_settings`, criar automaticamente um `vacation_request` para cada funcionario ativo dessa categoria (fabrica/armazem)
- Verificar se ja existe registro para evitar duplicados
- Adicionar hook `useCreateBulkVacationRequests` para inserir em lote
- Na listagem de ferias individuais de cada colaborador, as ferias coletivas tambem aparecem com badge "Coletiva"

---

### 5. Edge Function vacation-public Atualizada

Suportar multiplos periodos na acao "suggest":

- Receber array de periodos `[{start_date, end_date}, ...]`
- Apagar periodos antigos nao confirmados do mesmo token
- Criar novos periodos para cada par de datas
- Manter a mesma logica de confirmacao

---

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/components/vacations/VacationFormDialog.tsx` — reescrever com lista de periodos
- `src/pages/Vacations.tsx` — agrupar por colaborador com expand/collapse
- `src/pages/VacationPublic.tsx` — multiplos periodos na pagina publica
- `src/components/vacations/CollectiveVacationForm.tsx` — criar registos por colaborador ao guardar
- `src/hooks/useVacations.ts` — adicionar hook de criacao em lote e hook de delete
- `supabase/functions/vacation-public/index.ts` — suportar array de periodos
- `src/components/employees/EmployeeVacations.tsx` — mostrar periodos agrupados com totais

**Sem alteracoes no banco de dados** — a tabela `vacation_requests` ja suporta multiplos registos por employee+year. Cada periodo e uma linha separada.

**Fluxo resumido:**
1. Admin seleciona colaborador → adiciona N periodos → submete (cria N registos) → envia e-mail
2. Colaborador acede ao link → ve periodos sugeridos → pode alterar/sugerir novos periodos → confirma
3. Admin ve na listagem agrupada → aprova → marca como gozada apos o periodo
4. Ferias coletivas: admin define periodo → sistema cria registos para todos os colaboradores da categoria

