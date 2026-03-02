

## Plano: Corrigir Horários Part-Time no Relógio de Ponto e Vincular Utilizadora Alessandra

### Problema 1: Horários Part-Time (Barbara Ribeiro)

O modelo "Armazém Part-Time" tem `lunch_in_time: 00:00` e `clock_out_time: 00:00`, indicando que o funcionario so trabalha ate a hora do almoco (13:00). No entanto, o sistema atual sempre assume 4 etapas de picagem (Entrada, Saida Almoco, Retorno Almoco, Saida), o que faz com que:
- Apos Barbara registrar "Saida Almoco" (que e sua saida real), o sistema espera "Retorno Almoco" e "Saida", mostrando-a como atrasada para essas etapas inexistentes.

**Solucao**: Detectar horarios part-time (sem jornada pos-almoco) e ajustar o fluxo para apenas 2 picagens: **Entrada** e **Saida**.

### Problema 2: Vincular Alessandra Molino

A utilizadora "Alessandra" (profile id: `a1383f39...`) foi criada mas:
- Nao esta vinculada a funcionaria Alessandra Molino (employee id: `aeaaa981...`)
- Nao tem papel de admin atribuido

---

### Alteracoes Tecnicas

#### 1. Edge Function `time-clock-employees/index.ts`
- Detectar se o modelo e part-time verificando se `lunch_in_time` e `clock_out_time` sao `00:00:00` (sem jornada pos-almoco)
- Para part-time, o fluxo de `nextAction` sera: `clock_in` -> `clock_out` (pular `lunch_out`/`lunch_in`)
- Ajustar `scheduled_clock_out` para usar `lunch_out_time` como horario de saida do part-time
- Nao enviar `scheduled_lunch_out`/`scheduled_lunch_in` para part-time (evitar alertas falsos)
- Incluir flag `is_part_time` nos dados retornados

#### 2. Edge Function `time-clock-punch/index.ts`
- Detectar part-time da mesma forma
- Para part-time, apos `clock_in`, a proxima acao e `clock_out` (registrado no campo `lunch_out` ou `clock_out` do banco)
- Aplicar logica de saida antecipada usando `lunch_out_time` como horario previsto de saida

#### 3. `EmployeeCard.tsx` e `EmployeeData` interface
- Adicionar campo `is_part_time` na interface
- A funcao `isLate()` ja retorna `false` quando `scheduledTime` e null/undefined, entao ao nao enviar horarios pos-almoco, os alertas falsos desaparecem automaticamente
- Ajustar o label do horario para mostrar apenas `08:00-13:00` (sem horario de saida `00:00`)

#### 4. `TodayStatus.tsx`
- Funciona sem alteracoes pois ja usa o `today_status` retornado pelo backend

#### 5. `PinModal.tsx`
- Adaptar labels para part-time (ex: "Saida" em vez de "Saida Almoco")

#### 6. `UserManager.tsx` - Vincular Utilizador a Funcionario e Atribuir Papeis
- Adicionar dropdown para vincular o utilizador a um funcionario existente
- Adicionar dropdown para atribuir papel (Admin, Gestor, Funcionario)
- Acoes de vincular/desvincular e alterar papel diretamente na lista de utilizadores

#### 7. Dados - Vincular Alessandra e atribuir admin
- Atualizar `profiles` para definir `employee_id` da Alessandra
- Inserir na tabela `user_roles` o papel `admin` para a Alessandra

---

### Resumo dos Ficheiros Alterados

| Ficheiro | Tipo |
|---|---|
| `supabase/functions/time-clock-employees/index.ts` | Modificar |
| `supabase/functions/time-clock-punch/index.ts` | Modificar |
| `src/components/timeclock/EmployeeCard.tsx` | Modificar |
| `src/components/timeclock/PinModal.tsx` | Modificar |
| `src/components/settings/UserManager.tsx` | Modificar |
| Dados: profiles + user_roles | Inserir/Atualizar |

