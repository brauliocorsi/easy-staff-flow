## Objetivo

Tornar o Portal do Funcionário mais limpo, dinâmico e focado. Mostrar apenas o essencial ao colaborador, destacar o banco de horas, e simplificar a área de avaliação para que sirva exclusivamente para avaliar líderes (com opção anónima).

## 1. Novo design do dashboard (`src/pages/EmployeePortal.tsx`)

**Header redesenhado**
- Hero compacto com gradiente suave (tokens `primary` / `accent`), avatar grande, nome, cargo e departamento.
- Saudação dinâmica ("Bom dia/tarde/noite, {nome}") e data atual em português.
- Botões: "Avaliar Líder" (destaque) e "Sair".

**Hero de Banco de Horas (novo bloco principal)**
- Card grande no topo com saldo em horas (formato `+12h30` / `-2h15`), cor verde/vermelha conforme sinal.
- Mini barra/indicador visual e label "Saldo atual do banco de horas".
- Subtexto com últimos movimentos do mês (créditos vs débitos), se disponíveis.

**Grid de KPIs simplificado (4 cartões, não 6)**
1. Faltas injustificadas (mês atual)
2. Férias gozadas / direito (ano)
3. Formação `Xh / 40h` (barra de progresso)
4. Próxima reunião / advertências ativas (o que for relevante)

Cartões com hover sutil, ícone em círculo colorido, número grande em fonte display.

## 2. Simplificação de conteúdo

Manter apenas seções essenciais ao colaborador:
- **Dados pessoais** (compacto: email, telefone, admissão, departamento)
- **Banco de Horas** (saldo + últimos 5 movimentos, se houver)
- **Registos de Ponto recentes** (últimos 7 dias, em vez dos 60 atuais)
- **Faltas** (resumo + lista do ano)
- **Férias** (gozadas + marcadas, do ano atual)
- **Formação** (do ano atual, barra de 40h)
- **Advertências** (apenas se existirem)
- **Reuniões** (apenas próximas + últimas 3 concluídas)

Remover/esconder do portal (continuam no admin):
- Listas longas de EPIs, ferramentas, contratos, exames médicos completos — substituir por um único cartão "Documentos e Equipamentos" com contagens e link para falar com RH.
- Tarefas de manutenção — manter só se o colaborador tiver tarefas ativas; caso contrário esconder a seção inteira.

Tudo apresentado em layout responsivo com cards arredondados, espaçamento generoso, separadores subtis.

## 3. Avaliação refocada apenas em líderes

**Comportamento**
- Botão único no header: **"Avaliar o meu Líder"**.
- Remover do dialog as opções "Sugestão" e "Reclamação" — passam a viver no menu secundário "Enviar sugestão" (link discreto no rodapé do portal).
- O dialog de avaliação de líder mostra:
  - Selector de líder (lista vinda de `data.leaders`; pré-seleciona o `manager_id` do colaborador, se existir).
  - 5 estrelas para nota geral + campos opcionais: pontos fortes, a melhorar, comentário.
  - Switch **"Enviar anonimamente"** (default: ligado, para dar confiança).
  - Botão "Enviar avaliação".
- Quando anónimo, mantém o comportamento atual (`employee_id = null`, trigger `enforce_anonymous_suggestion`).

**Remover do portal**
- Bloco de "Avaliações pendentes" (evaluator) — esse fluxo passa a estar apenas no app interno; o portal é só para o colaborador avaliar o seu líder.
- Bloco de submissão de avaliação formal (`employee_evaluations`) deixa de aparecer no portal.

**Backend (`supabase/functions/employee-portal/index.ts`)**
- Manter ação `submit_suggestion` (já suporta `evaluated_leader_id` e `is_anonymous`).
- Remover/parar de chamar `get_pending_evaluations` e `submit_evaluation` a partir do portal (manter no edge function por compatibilidade, mas não invocar).

## 4. Detalhes técnicos

- Ficheiros tocados:
  - `src/pages/EmployeePortal.tsx` — refator completo do layout, KPIs, seções, dialog de avaliação.
  - Pequenos componentes auxiliares (KPI card, balance hero) internos ao próprio ficheiro para não inflar a árvore.
- Usar tokens semânticos (`bg-primary/10`, `text-primary`, `bg-card`, `text-muted-foreground`, gradientes com `from-primary/10 via-background to-accent/10`).
- Animações suaves (`transition-all`, `hover:shadow-md`) sem novas dependências.
- Sem alterações de schema; sem migrations.
- Sem alterações no admin (página `Evaluations`, `Suggestions`, etc.).

## 5. Fora do âmbito

- Não alterar a lógica do banco de horas, faltas, férias ou avaliações no lado admin.
- Não criar novas tabelas nem novos endpoints.
- Não alterar o login por PIN.
