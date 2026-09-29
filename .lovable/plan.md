# Terminal de ponto: mostrar todas as picagens do dia, sempre

## Objetivo
No relógio de ponto (terminal), cada funcionário deve ver **todas as picagens já registadas hoje com as respetivas horas reais** — incluindo picagens feitas fora do horário de trabalho (entrada mais cedo, saída mais tarde, etc.). Nada é escondido nem filtrado.

## Estado atual
- O terminal (`TimeClock.tsx` + `EmployeeCard.tsx`) mostra apenas o estado do dia ("Próximo: registar entrada", "Atrasado", etc.) — nunca as horas das picagens.
- A edge function `time-clock-employees` já lê as picagens do dia, mas não as devolve ao terminal.
- O `PinModal` mostra só a próxima ação, sem o histórico do dia.

## Alterações

### 1. Edge function `time-clock-employees`
- Incluir no resultado de cada funcionário as picagens do dia já lidas: `clock_in`, `lunch_out`, `lunch_in`, `clock_out` (horas reais registadas, sem qualquer filtro por horário).

### 2. Cartão do funcionário (`EmployeeCard.tsx`)
- Nova secção "Picagens de hoje" no cartão, sempre visível quando existir pelo menos uma picagem:
  - Lista com rótulo + hora real (formato HH:mm, fuso Europe/Lisbon): Entrada, Saída Almoço, Retorno Almoço, Saída.
  - Para part-time: apenas Entrada e Saída.
  - Picagens fora do horário aparecem exatamente como as outras — a hora mostrada é sempre a hora real da picagem.
- Mantém-se o estado do dia, aviso de atraso e aviso de picagem em falta.

### 3. Modal de PIN (`PinModal.tsx`)
- Acima do campo de PIN, mostrar as picagens já registadas hoje (mesma lista de horas reais), para o funcionário confirmar o que já picou antes de registar a próxima.

### 4. Sem impacto em regras
- Nenhuma alteração a cálculos, saldos, tolerâncias ou motor de apuramento — é apenas apresentação das picagens reais que já existem na base de dados.

## Validação
- Typecheck + testes automáticos existentes.
- Verificação visual do terminal (cartão com picagens e modal) na pré-visualização.

## Fora de âmbito
- Nada é publicado; sem alterações a dados históricos.
