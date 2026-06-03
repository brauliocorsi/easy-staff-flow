## Refatoração — Banco de Horas

A página atual empilha tudo numa coluna só (filtros → resumo → 5 cards → tabela diária → conta corrente → aprovações → fecho mensal). Vamos reorganizar em **abas**, com cabeçalho hero, seletor de funcionário visual e cartões mais clean alinhados ao novo design system (Emerald + Sora/Manrope).

### 1. Estrutura nova da página

```text
┌──────────────────────────────────────────────────────────┐
│ HERO — título + período + ação "Usar horas"              │
├──────────────────────────────────────────────────────────┤
│ SELETOR DE FUNCIONÁRIO (busca + lista lateral OU pills) │
├──────────────────────────────────────────────────────────┤
│ Tabs:                                                    │
│  [ Visão Geral ] [ Conta Corrente ] [ Aprovações ] [ Fecho Mensal ] │
└──────────────────────────────────────────────────────────┘
```

### 2. Hero compacto
- Título "Banco de Horas" + subtítulo curto
- Seletor de mês/ano em chips/pills (◀ Novembro 2026 ▶) com navegação por setas
- Botão "Usar horas do banco" (admin) à direita

### 3. Seletor de funcionário moderno
Substituir o `Select` de 260px por uma faixa horizontal com:
- Input de busca por nome com ícone
- Quando nenhum selecionado → mostra **tabela resumo** modernizada (cards/linhas) com avatar, nome, saldo mensal e acumulado em badges coloridos; clicar abre o detalhe
- Quando selecionado → mostra **card do funcionário** no topo (avatar + nome + cargo + botão "Voltar")

### 4. Aba "Visão Geral" (saldos + detalhe diário)
**Painel de saldos** — reduzir de 5 para **3 cards principais grandes**, em vez de 5 cards pequenos amontoados:
- **Saldo do Mês** (verde se positivo, vermelho se negativo) — com mini-breakdown "+Xh extra / -Yh défice" abaixo
- **Saldo do Mês Anterior** (transitado)
- **Saldo Acumulado** — destaque maior com badge "A favor do funcionário" / "A dever à empresa"

Cards usam gradiente sutil esmeralda, ícones com fundo redondo e tipografia Sora em peso 700 para os valores monoespaçados.

**Tabela diária** mantém a lógica atual, mas:
- Header sticky
- Linhas com estado colorido por tipo (folga/férias/feriado/falta-banco) já existe — refinar com pill esquerda colorida em vez de bg
- Expansão inline mais limpa (cards de 4 pontos: entrada / almoço / regresso / saída) com previsto vs real lado a lado e diferença em verde/vermelho
- Tolerâncias movem para um popover "ⓘ Tolerâncias" em vez de linha solta de texto

### 5. Aba "Conta Corrente"
Mover o card de Conta Corrente para uma aba dedicada:
- 7 valores (aprovado/pendente/pago/rejeitado/usado/disponível/potencial) em grid responsivo de cards menores com ícone
- Destaque grande para "Saldo Disponível" no topo
- Lista cronológica dos movimentos (`time_bank_movements`) — atualmente não é mostrada; adicionar tabela com data, tipo, minutos, decisão, descrição

### 6. Aba "Aprovações"
Embrulha o `OvertimeApprovalsTab` existente num card limpo, sem alterar lógica.

### 7. Aba "Fecho Mensal"
Embrulha o `MonthlyClosureTab` existente num card limpo, sem alterar lógica.

### 8. Detalhes técnicos
- Arquivo único: `src/pages/OvertimeBank.tsx` (refator) — sem mudanças nas queries, hooks ou cálculos (`calculateWorkday`, `computeBalance`, etc.)
- Novos sub-componentes locais no mesmo arquivo: `PeriodNavigator`, `EmployeePicker`, `BalanceHeroCards`, `DailyTable` para reduzir o tamanho do JSX
- Adicionar `<Tabs>` do shadcn já presente no projeto
- Manter `UseBankHoursDialog`, `OvertimeApprovalsTab`, `MonthlyClosureTab`, `BalanceLine` como estão
- Sem mudanças de banco, sem mudanças de regras de negócio, sem mudanças nas tolerâncias

### Fora de escopo
- Refator de `OvertimeApprovalsTab` e `MonthlyClosureTab` (componentes internos) — só receberão um wrapper visual; refator profundo desses pode ser feito numa segunda passagem se desejado
- Mudanças no portal do funcionário
- Lógica de cálculo de saldo
