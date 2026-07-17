
# Mural de Planejamento

Nova página independente para gestão de projetos e atividades entre os admins (Alessandra, Braulio, Raissa e outros admins do sistema). Não altera nenhum módulo existente — só adiciona tabelas próprias, componentes próprios e uma rota nova.

## Acesso
- Rota: `/mural` (protegida, com `useIsAdmin()`).
- Item no sidebar dentro de um novo grupo **"Planejamento"** com ícone Kanban.
- Não-admins não veem o item nem conseguem entrar.

## Estrutura visual
Uma página com header + tabs de visualização:

```text
Mural de Planejamento                            [+ Novo projeto]
────────────────────────────────────────────────────────────────
Filtros: Projeto ▾  Responsável ▾  Urgência ▾  SLA ▾   Busca…
────────────────────────────────────────────────────────────────
[ Lista ] [ Kanban ] [ Gantt ]
```

### Lista (tabela)
Colunas: Título · Projeto · Responsáveis (avatares) · Urgência · Dificuldade · Esforço · Prazo · SLA · Progresso.
Ordenável e filtrável. Clicar na linha abre o detalhe da tarefa.

### Kanban
4 colunas fixas: **A fazer · Em curso · Bloqueado · Concluído** (baseado em `status`).
Cards com título, projeto, avatares, badge de urgência, dificuldade (pontos), barra de progresso do checklist, semáforo SLA.
Drag-and-drop entre colunas atualiza `status`.

### Gantt
Linha temporal horizontal por tarefa (uma linha por tarefa, agrupadas por projeto).
Cada barra vai de `start_date` a `due_date`, cor pela urgência, hachura quando concluída.
Escala: dias com marcador de "hoje". Zoom Semana/Mês.
Só visualização + tooltip; edição de datas no diálogo da tarefa.

### Detalhe da tarefa (Sheet lateral)
- Título, descrição rica (textarea), projeto, status.
- Responsáveis (multi-select de admins).
- Urgência: baixa / média / alta / crítica (badge colorido).
- Dificuldade: 1–5 (escala).
- Esforço: número de horas estimadas.
- Datas: início e prazo.
- **Checklist** com itens marcáveis (progresso = itens feitos / total).
- **Comentários / sugestões** em ordem cronológica, com autor e timestamp.
- Etiquetas customizáveis por projeto (opcional na v1: tags de texto livre em array).

## SLA (simplificado, cliente-side)
Baseado só em `due_date` vs hoje:
- Sem prazo → cinza "sem SLA".
- Concluída → verde "cumprido" (fica no prazo se `updated_at ≤ due_date`, senão âmbar "tardio").
- Faltam >3 dias → verde.
- Faltam 0–3 dias → âmbar "a vencer".
- Passou do prazo e não concluída → vermelho "vencida".

Calculado em `src/lib/muralSla.ts` (função pura + testes vitest).

## Modelo de dados (novas tabelas, isoladas)

- `mural_projects` — projeto (título, descrição, cor, criado_por, arquivado).
- `mural_tasks` — tarefa (project_id, título, descrição, status, urgência, dificuldade 1–5, esforço horas, start_date, due_date, completed_at, tags text[], order_index).
- `mural_task_assignees` — (task_id, user_id) muitos-para-muitos.
- `mural_checklist_items` — (task_id, texto, feito, order_index).
- `mural_comments` — (task_id, author_id, corpo, created_at).

Todas com RLS: só quem passa em `is_admin(auth.uid())` pode ler/escrever (leitura/escrita completa para admins). Sem acesso anon. Grants para authenticated + service_role.

## Ficheiros a criar
- `supabase/migrations/<ts>_mural_planejamento.sql` — 5 tabelas + GRANTs + RLS + índices + trigger `update_updated_at_column`.
- `src/pages/Mural.tsx` — página com tabs e filtros.
- `src/components/mural/ProjectFormDialog.tsx`
- `src/components/mural/TaskFormDialog.tsx` (o Sheet de detalhe)
- `src/components/mural/MuralList.tsx`
- `src/components/mural/MuralKanban.tsx`
- `src/components/mural/MuralGantt.tsx` (SVG simples, sem lib nova)
- `src/components/mural/TaskChecklist.tsx`
- `src/components/mural/TaskComments.tsx`
- `src/hooks/useMural.ts` — queries/mutations react-query.
- `src/lib/muralSla.ts` + `muralSla.test.ts`.

## Ficheiros a editar (mínimos)
- `src/App.tsx` — nova rota `/mural`.
- `src/components/layout/AppSidebar.tsx` — novo grupo "Planejamento" com item "Mural" (mostrado só para admins via `useIsAdmin`).

## Não incluído nesta v1
- Notificações por email/push.
- Dependências entre tarefas no Gantt.
- Etiquetas com paleta gerida em Configurações (fica tag livre por agora).
- Exportação PDF/Excel.

## Validação
- `tsgo` sem erros.
- Testes de `muralSla` verdes.
- Fluxo manual: criar projeto → criar tarefa → atribuir 2 admins → checklist + comentário → mover no Kanban → ver barra no Gantt → SLA muda conforme a data.
