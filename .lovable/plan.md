
# Venda de Dias de Ferias pelo Colaborador

## Objetivo
Permitir que o colaborador, atraves do link publico de ferias, possa "vender" dias de ferias a empresa. O pedido de venda fica como sugestao pendente para o RH aprovar.

## Alteracoes Necessarias

### 1. Migracaoo de Base de Dados
Adicionar uma nova coluna `sold_days` (integer, default 0) na tabela `vacation_requests` para registar quantos dias o colaborador pretende vender naquele ano. Tambem adicionar um campo `sell_status` (text, default null) com valores possiveis: `pending_sell`, `sell_approved`, `sell_rejected` para controlar o fluxo de aprovacao.

### 2. Edge Function `vacation-public/index.ts`
- Adicionar nova acao `sell` que recebe o numero de dias a vender e cria/atualiza um registo de venda:
  - Valida que os dias a vender nao excedem os dias disponiveis (entitled - dias ja agendados)
  - Cria um `vacation_request` com `category: "individual"`, `days_count` igual aos dias vendidos, `status: "pending"`, e `sold_days` preenchido
  - Ou alternativamente, usa o registo existente e atualiza `sold_days` e `sell_status: "pending_sell"`
- Na acao `get`, retornar tambem informacao sobre dias ja vendidos

### 3. Pagina Publica `VacationPublic.tsx`
- Adicionar uma seccao "Vender Dias de Ferias" com:
  - Input numerico para selecionar quantos dias quer vender
  - Indicacao do saldo disponivel (dias de direito - dias agendados - dias ja vendidos)
  - Botao "Solicitar Venda" que envia o pedido
  - Mensagem informativa de que a venda depende de aprovacao do RH
- Mostrar estado da venda se ja houver pedido (pendente, aprovado, rejeitado)

### 4. Pagina Admin `Vacations.tsx`
- No grupo de cada funcionario, mostrar badge com dias vendidos (se houver)
- Adicionar botao para aprovar/rejeitar pedidos de venda pendentes
- Ao aprovar a venda, subtrair os dias do saldo total disponivel do funcionario (reduzindo `total_entitled_days` ou ajustando o calculo)

### 5. Calculo de Saldo
- O saldo restante passa a ser: `total_entitled_days - dias_agendados - sold_days_approved`
- Validacao no `VacationFormDialog.tsx` tambem deve considerar dias vendidos aprovados

## Detalhes Tecnicos

### Migracao SQL
```sql
ALTER TABLE public.vacation_requests 
  ADD COLUMN sold_days integer NOT NULL DEFAULT 0,
  ADD COLUMN sell_status text DEFAULT NULL;
```

### Fluxo
1. Colaborador abre link publico -> ve seccao "Vender Dias"
2. Seleciona quantidade de dias -> clica "Solicitar Venda"
3. Edge function cria registo com `sold_days = N`, `sell_status = 'pending_sell'`
4. RH ve pedido pendente na pagina de ferias -> aprova ou rejeita
5. Se aprovado, os dias sao subtraidos do saldo disponivel

### Ficheiros a Modificar
- `supabase/functions/vacation-public/index.ts` - nova acao "sell"
- `src/pages/VacationPublic.tsx` - UI de venda para o colaborador
- `src/pages/Vacations.tsx` - gestao de vendas pelo admin
- `src/hooks/useVacations.ts` - tipos atualizados
- `src/components/vacations/VacationFormDialog.tsx` - validacao atualizada
- Nova migracao SQL para colunas `sold_days` e `sell_status`
