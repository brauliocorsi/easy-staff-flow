
# Relogio de Ponto - Sistema de Cards + PIN

## Resumo
Pagina publica onde funcionarios selecionam seu card, digitam o PIN de 4 digitos e registram ponto automaticamente. O sistema detecta qual e a proxima acao (entrada, saida almoco, retorno almoco, saida) com base no horario vinculado ao funcionario.

---

## 1. Banco de Dados - Nova tabela `employee_schedules`

Criar tabela para vincular horarios a cada funcionario:

```text
employee_schedules
- id (uuid, PK)
- employee_id (uuid, FK -> employees)
- day_of_week (integer, 0=domingo...6=sabado)
- clock_in_time (time) -- ex: 08:00
- lunch_out_time (time) -- ex: 12:00
- lunch_in_time (time) -- ex: 13:00
- clock_out_time (time) -- ex: 17:00
- is_day_off (boolean, default false)
- created_at, updated_at
```

RLS: leitura publica (necessario para o terminal de ponto), escrita apenas admin.

Tambem precisamos de uma policy que permita INSERT/UPDATE anonimo na `time_clock_records` para o terminal de ponto funcionar. Para seguranca, faremos isso via Edge Function com service role, mantendo as policies restritas.

---

## 2. Edge Function `time-clock-punch`

Funcao backend que recebe `employee_id` + `pin_code` e:
1. Valida o PIN contra `employees.pin_code`
2. Busca o registro do dia atual em `time_clock_records`
3. Busca o horario do funcionario em `employee_schedules` para o dia da semana
4. Determina a proxima acao automaticamente:
   - Sem registro -> `clock_in`
   - Com clock_in, sem lunch_out -> `lunch_out`
   - Com lunch_out, sem lunch_in -> `lunch_in`
   - Com lunch_in, sem clock_out -> `clock_out`
   - Tudo preenchido -> Erro "ponto ja completo"
5. Retorna os dados atualizados + proxima acao + horarios do turno

---

## 3. Edge Function `time-clock-employees`

Funcao para listar funcionarios ativos (sem expor PIN):
- Retorna `id`, `first_name`, `last_name`, `position`, `avatar_url`, `department` dos funcionarios com status "active"
- Tambem retorna o status do ponto do dia (qual foi a ultima batida)

---

## 4. Frontend - Pagina `/ponto`

### Tela principal (selecao de funcionario)
- Grid de cards com foto/iniciais, nome e cargo de cada funcionario ativo
- Relogio digital grande no topo mostrando hora atual
- Campo de busca para filtrar funcionarios
- Ao clicar em um card, abre o modal de PIN

### Modal de PIN
- Nome e foto do funcionario selecionado
- Input OTP de 4 digitos (usando componente `InputOTP` ja existente)
- Indicacao visual de qual sera a proxima batida (Entrada, Saida Almoco, Retorno Almoco, Saida)
- Horarios do turno do funcionario exibidos como referencia
- Botao "Registrar"
- Feedback visual de sucesso/erro com toast

### Componentes
- `src/components/timeclock/EmployeeCardGrid.tsx` - Grid de cards
- `src/components/timeclock/EmployeeCard.tsx` - Card individual
- `src/components/timeclock/PinModal.tsx` - Modal de PIN + registro
- `src/components/timeclock/ClockDisplay.tsx` - Relogio digital
- `src/components/timeclock/TodayStatus.tsx` - Status das batidas do dia

---

## 5. Fluxo do Usuario

```text
1. Funcionario acessa /ponto
2. Ve grid de cards com todos os colegas
3. Clica no seu card
4. Modal abre mostrando: nome, proxima acao (ex: "Entrada - 08:00"), input PIN
5. Digita PIN de 4 digitos
6. Sistema valida PIN via edge function
7. Registra a batida automaticamente
8. Toast de sucesso: "Entrada registrada as 08:02"
9. Modal fecha, card atualiza status
```

---

## Detalhes Tecnicos

- A pagina `/ponto` nao requer autenticacao (e um terminal publico)
- Toda validacao e feita server-side na edge function usando service role
- O PIN e validado no backend, nunca exposto no frontend
- Os horarios do turno servem como referencia visual, nao bloqueiam o registro
- Relogio atualiza a cada segundo via `setInterval`
- A lista de funcionarios e carregada via edge function (sem acesso direto ao banco)
