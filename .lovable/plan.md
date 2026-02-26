

## Plano: Sistema Completo de Ferias com Categorias e Fluxo de Aprovacao

### Resumo

Implementar um sistema de ferias com duas categorias (coletiva de fabrica/armazem e individual combinada), fluxo de negociacao por e-mail com o funcionario, mapa anual de ferias, e indicacao no registro do funcionario se tem ferias a gozar.

---

### 1. Alteracoes no Banco de Dados

A tabela `vacation_requests` ja existe com campos basicos. Precisamos adicionar campos para suportar o novo fluxo:

**Alterar tabela `vacation_requests`:**
- `category` (text, default 'individual') — valores: 'individual', 'factory', 'warehouse'
- `year` (integer, default extract(year from now())) — ano de referencia das ferias
- `total_entitled_days` (integer, default 22) — dias de ferias a que o funcionario tem direito
- `employee_confirmed` (boolean, default false) — se o funcionario confirmou as datas
- `admin_confirmed` (boolean, default false) — se o admin confirmou/aceitou
- `token` (uuid, default gen_random_uuid()) — token unico para link publico de escolha de ferias
- `enjoyed` (boolean, default false) — se as ferias ja foram gozadas

**Nova tabela `vacation_settings`:**
- `id` (uuid PK)
- `year` (integer, not null)
- `category` (text, not null) — 'factory' ou 'warehouse'
- `start_date` (date, not null)
- `end_date` (date, not null)
- `notes` (text, nullable)
- `created_at` (timestamptz)

Politicas RLS: admins podem gerir, todos podem ver.

---

### 2. Edge Function: `vacation-public` (Link Publico para Funcionario)

Quando o admin cria ferias individuais, envia um link por e-mail ao funcionario. O funcionario acede ao link e sugere/confirma datas.

- Recebe `token` como parametro
- Retorna dados do pedido de ferias (sem dados sensiveis)
- Permite POST para o funcionario submeter/sugerir datas
- Atualiza `employee_confirmed = true` apos confirmacao

---

### 3. Edge Function: `send-vacation-email`

Envia e-mail ao funcionario com link para escolher/confirmar ferias:
- Recebe `vacation_id`
- Busca dados do pedido + funcionario
- Gera link publico com token
- Envia e-mail HTML via Resend (LOVABLE_API_KEY)
- Conteudo: informacao do periodo sugerido, link para aceitar/sugerir alteracao

---

### 4. Pagina de Ferias (`Vacations.tsx`) — Reescrita Completa

**Cabecalho com tabs/filtros:**
- Aba "Individual" — ferias combinadas com cada funcionario
- Aba "Fabrica" — periodo coletivo de fabrica
- Aba "Armazem" — periodo coletivo de armazem

**Funcionalidades por aba:**

*Coletivas (Fabrica/Armazem):*
- Admin define periodo fixo para o ano (data inicio/fim)
- Aplica-se automaticamente a todos os funcionarios da categoria
- Visualizacao do periodo definido

*Individuais:*
- Admin cria pedido de ferias para um funcionario
- Envia link por e-mail ao funcionario para escolher datas
- Funcionario sugere, admin aprova/contrapropoe
- Status: pendente → sugerido pelo funcionario → aprovado → gozado

**Mapa Anual:**
- Visualizacao tipo calendario/timeline mostrando todos os funcionarios e seus periodos de ferias
- Filtro por ano
- Cores diferentes para cada categoria

**Cards de resumo:**
- Total de funcionarios com ferias a gozar
- Ferias aprovadas vs pendentes
- Dias restantes por categoria

---

### 5. Integracao no Registro de Funcionarios

No `EmployeeFormDialog.tsx`, adicionar seccao "Ferias" (quando editando):
- Mostrar dias de ferias no ano corrente (total, gozados, restantes)
- Badge indicando se tem ferias a gozar ou nao
- Lista resumida dos periodos de ferias do ano

Na tabela de funcionarios (`Employees.tsx`):
- Nova coluna "Ferias" com badge verde/vermelho indicando se tem ferias pendentes a gozar
- Tooltip com resumo dos dias

---

### 6. Pagina Publica de Escolha de Ferias

Nova pagina `VacationPublic.tsx` (rota `/ferias-publica/:token`):
- Funcionario acede via link recebido por e-mail
- Ve o periodo sugerido pelo admin (se houver)
- Pode selecionar/sugerir datas de ferias num calendario
- Botao de confirmar envia a escolha
- Apos confirmacao, admin e notificado

---

### 7. Fluxo Completo

```text
Admin cria ferias individuais
       |
       v
E-mail enviado ao funcionario com link
       |
       v
Funcionario acede ao link publico
       |
       v
Funcionario sugere/confirma datas
       |
       v
Admin ve sugestao no sistema
       |
       v
Admin aprova ou contrapropoe
       |
       v
Funcionario aceita → Ferias registadas no mapa
       |
       v
Admin marca como "gozada" apos o periodo
```

---

### Detalhes Tecnicos

**Arquivos a criar:**
- `src/hooks/useVacations.ts` — CRUD de vacation_requests e vacation_settings
- `src/components/vacations/VacationFormDialog.tsx` — formulario de criacao (individual/coletiva)
- `src/components/vacations/VacationMap.tsx` — mapa anual visual
- `src/components/vacations/CollectiveVacationForm.tsx` — formulario para ferias coletivas
- `src/components/employees/EmployeeVacations.tsx` — seccao de ferias no registro do funcionario
- `src/pages/VacationPublic.tsx` — pagina publica para funcionario escolher ferias
- `supabase/functions/vacation-public/index.ts` — edge function para acesso publico
- `supabase/functions/send-vacation-email/index.ts` — edge function para envio de e-mail

**Arquivos a modificar:**
- `src/pages/Vacations.tsx` — reescrita completa
- `src/pages/Employees.tsx` — adicionar coluna de ferias
- `src/components/employees/EmployeeFormDialog.tsx` — adicionar seccao de ferias
- `src/App.tsx` — adicionar rota publica `/ferias-publica/:token`
- `supabase/config.toml` — registar novas edge functions

**Migracao SQL:**
- ALTER TABLE vacation_requests ADD COLUMN category, year, total_entitled_days, employee_confirmed, admin_confirmed, token, enjoyed
- CREATE TABLE vacation_settings (periodos coletivos)
- RLS policies para ambas as tabelas

