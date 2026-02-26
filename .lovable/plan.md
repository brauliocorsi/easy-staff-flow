
# Avaliacao de Funcionarios - Sistema de Avaliacao por Lider

## Resumo
Criar um sistema onde o Admin pode solicitar a um lider (manager/funcionario com cargo de chefia) que avalie um funcionario. O lider recebe a tarefa, preenche a avaliacao, e ao concluir ela fica disponivel para o Admin que a solicitou.

## 1. Base de Dados

Criar tabela `employee_evaluations`:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador |
| employee_id | uuid (FK employees) | Funcionario avaliado |
| evaluator_id | uuid (FK employees) | Lider que avalia |
| requested_by | uuid (FK auth.users) | Admin que solicitou |
| status | text | `pending`, `in_progress`, `completed` |
| rating | integer | Nota geral 1-5 |
| performance_rating | integer | Desempenho 1-5 |
| teamwork_rating | integer | Trabalho em equipa 1-5 |
| punctuality_rating | integer | Pontualidade 1-5 |
| communication_rating | integer | Comunicacao 1-5 |
| strengths | text | Pontos fortes |
| improvements | text | Pontos a melhorar |
| comments | text | Comentarios gerais |
| completed_at | timestamptz | Data de conclusao |
| created_at | timestamptz | Data de criacao |

RLS Policies:
- Admins podem gerir tudo (ALL)
- Avaliadores podem ver e atualizar as suas avaliacoes atribuidas (SELECT/UPDATE where evaluator employee matches user)

## 2. Nova Pagina: `/avaliacoes`

**Vista Admin:**
- Botao "Nova Avaliacao" abre dialog para:
  - Selecionar funcionario a avaliar
  - Selecionar lider avaliador
- Lista de todas as avaliacoes com tabs: Todas / Pendentes / Concluidas
- Cards com status visual (pendente = amarelo, concluida = verde)
- Ao clicar numa avaliacao concluida, ver detalhes completos com as notas por categoria em estrelas

**Vista Avaliador (via portal ou pagina):**
- O lider avaliador acede via Edge Function no portal do funcionario (acao `get_pending_evaluations` e `submit_evaluation`)
- Formulario com:
  - Notas de 1-5 estrelas para cada categoria
  - Campos de texto para pontos fortes, melhorias e comentarios
  - Botao concluir

## 3. Edge Function: Atualizar `employee-portal`

Adicionar duas novas acoes:
- `get_pending_evaluations`: retorna avaliacoes pendentes atribuidas ao funcionario logado
- `submit_evaluation`: preenche e conclui a avaliacao

## 4. Integracao

- Adicionar item "Avaliacoes" no sidebar (`ClipboardCheck` icon, rota `/avaliacoes`)
- Registar rota `/avaliacoes` no `App.tsx` como rota protegida
- Na pagina de perfil do funcionario (`EmployeeProfile.tsx`), adicionar seccao mostrando avaliacoes recebidas

## 5. Ficheiros a Criar/Modificar

| Acao | Ficheiro |
|------|---------|
| Criar | `src/pages/Evaluations.tsx` - Pagina principal de avaliacoes |
| Criar | `src/components/evaluations/EvaluationFormDialog.tsx` - Dialog para criar avaliacao |
| Criar | `src/components/evaluations/EvaluationDetailDialog.tsx` - Dialog para ver detalhes |
| Criar | `src/components/evaluations/EvaluationCard.tsx` - Card visual de avaliacao |
| Modificar | `src/App.tsx` - Adicionar rota |
| Modificar | `src/components/layout/AppSidebar.tsx` - Adicionar menu |
| Modificar | `supabase/functions/employee-portal/index.ts` - Acoes de avaliacao |
| Modificar | `src/pages/EmployeePortal.tsx` - Seccao de avaliacoes pendentes |
| Modificar | `src/pages/EmployeeProfile.tsx` - Mostrar avaliacoes recebidas |
| Migracoes | Nova tabela + RLS policies |

## Detalhes Tecnicos

- A tabela usa `requested_by` referenciando o user admin (nao FK direta a auth.users para seguranca)
- `evaluator_id` referencia `employees.id` para identificar o lider
- O portal do funcionario mostra avaliacoes pendentes apenas para quem e avaliador
- Quando o avaliador submete, o status muda para `completed` e `completed_at` e preenchido
- O admin ve todas as avaliacoes e pode filtrar por status
