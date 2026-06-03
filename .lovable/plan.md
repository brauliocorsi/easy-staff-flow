## Objetivo
Garantir que as férias já gozadas (individuais e coletivas — Fábrica/Armazém) constam corretamente no histórico de cada funcionário e são abatidas do saldo, com possibilidade de ajuste manual pelo gestor.

## Diagnóstico do que já existe
- A função `isVacationEnjoyed()` já considera "gozada" qualquer férias aprovada cujo `end_date < hoje`. Logo, registos de férias coletivas passadas já aparecem como gozadas no perfil do funcionário e no Portal.
- O `CollectiveVacationForm` (separadores Fábrica/Armazém) já cria registos `vacation_requests` aprovados para cada funcionário do departamento, seguindo o mapa de férias (`vacation_settings`).
- O que falta: (a) marcar explicitamente o campo `enjoyed=true` nos registos passados para ficarem rotulados como "Gozada" de forma definitiva (não apenas inferido pela data); (b) um botão de sincronização rápida que crie/atualize registos para todos os funcionários da Fábrica/Armazém seguindo o mapa de férias atual e marque automaticamente os períodos já passados como gozados; (c) manter a opção manual já existente (toggle "Gozada / Não gozada" e edição por funcionário).

## Plano de implementação

### 1. Botão "Sincronizar gozadas" no topo da página `Mapa de Férias`
- Para o ano selecionado:
  1. Para cada `vacation_setting` (Fábrica e Armazém) — garante que todos os funcionários ativos do departamento têm um `vacation_request` aprovado correspondente. Se faltar, cria.
  2. Para todos os `vacation_requests` do ano (qualquer categoria) com `end_date < hoje`, `status != 'rejected'` e sem `sell_status` — define `enjoyed = true`.
- Mostra toast com resumo: "X registos criados, Y marcados como gozados".

### 2. Pequenos ajustes na UI
- No cabeçalho dos separadores Fábrica e Armazém do `CollectiveVacationForm`, adicionar nota informativa: "Períodos com fim no passado são marcados automaticamente como gozados ao sincronizar".
- O toggle manual "Gozada / Não gozada" por registo já existe e mantém-se (ajuste manual pelo gestor).

### 3. Sem alterações de schema
A coluna `enjoyed` já existe na tabela `vacation_requests`. Tudo é feito por `UPDATE`/`INSERT` no frontend usando o cliente Supabase (admin tem RLS `is_admin` para gerir tudo).

## Detalhes técnicos
- Ficheiro novo: `src/hooks/useSyncEnjoyedVacations.ts` — hook que executa as duas operações descritas em "1".
- Ficheiro alterado: `src/pages/Vacations.tsx` — botão "Sincronizar gozadas" ao lado de "Novo Pedido"; invalida queries após sucesso.
- Sem alterações em edge functions, RLS ou migrações.
