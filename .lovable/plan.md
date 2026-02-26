

# Modulo Completo de Reunioes

## Resumo

Implementar o fluxo completo de reunioes: criar reuniao com participantes e horarios, pagina de reuniao aberta para registrar pautas em tempo real, pagina publica com timer e pautas, e envio automatico de ata por email ao finalizar.

---

## 1. Alteracoes no Banco de Dados

Adicionar coluna `end_time` na tabela `meetings` para registrar hora de termino (a `meeting_date` ja serve como inicio):

```text
ALTER TABLE meetings ADD COLUMN end_time timestamptz;
```

Adicionar policy de SELECT publico na tabela `meetings`, `meeting_agendas` e `meeting_participants` para a URL publica (usando uma rota especifica via edge function para nao expor tudo).

Habilitar realtime nas tabelas `meetings`, `meeting_agendas` e `meeting_participants` para atualizacoes em tempo real na pagina publica.

---

## 2. Componentes e Paginas

### 2a. Pagina `/reunioes` - Lista de Reunioes (admin, protegida)

- Botao "Nova Reuniao" abre dialog de criacao
- Formulario com: titulo, descricao, data/hora inicio, data/hora termino, selecao de participantes (multi-select de funcionarios)
- Tabela/cards listando reunioes com status (agendada, em andamento, concretizada)
- Clicar numa reuniao abre a pagina de detalhe

### 2b. Dialog de Criacao `MeetingFormDialog`

- Campos: titulo, descricao, data/hora inicio, data/hora termino, departamento (opcional)
- Multi-select de participantes (lista de funcionarios ativos)
- Ao salvar: insere em `meetings` + `meeting_participants`

### 2c. Pagina `/reunioes/:id` - Detalhe da Reuniao (admin, protegida)

- Cabecalho com titulo, status, horarios, participantes
- Timer mostrando tempo restante ate `end_time`
- Area de pautas: input para adicionar novas pautas em tempo real
- Cada pauta aparece como card com titulo e descricao
- Campo "decisao" em cada pauta para registrar o que foi decidido
- Botao "Finalizar Reuniao" que muda status para "completed" e dispara envio de email

### 2d. Pagina `/reuniao-publica/:id` - Vista Publica (sem autenticacao)

- Timer grande com contagem regressiva ate o fim da reuniao
- Lista de participantes com nome e cargo
- Cards das pautas adicionadas em tempo real (via realtime subscription)
- Sem possibilidade de editar, apenas visualizar
- Layout limpo e focado na apresentacao

---

## 3. Edge Function `send-meeting-minutes`

Funcao backend chamada ao finalizar a reuniao:

1. Recebe `meeting_id`
2. Busca dados da reuniao, participantes (com emails) e pautas
3. Gera o conteudo da ata (HTML formatado)
4. Envia email para cada participante usando Resend (via LOVABLE_API_KEY)
5. Atualiza status da reuniao para "completed"

---

## 4. Rota Publica via Edge Function `meeting-public`

Edge function que retorna dados da reuniao sem autenticacao:
- Recebe `meeting_id` como parametro
- Retorna: titulo, descricao, horarios, participantes (nome + cargo), pautas
- Nao expoe emails ou dados sensiveis

---

## 5. Fluxo do Usuario

```text
1. Admin cria reuniao com titulo, horarios, participantes
2. No dia da reuniao, abre /reunioes/:id
3. Ve o timer com contagem regressiva
4. Vai digitando pautas conforme a reuniao acontece
5. Pode partilhar o link /reuniao-publica/:id num ecra para todos verem
6. A pagina publica mostra timer + pautas em tempo real
7. Ao finalizar, clica "Finalizar Reuniao"
8. Sistema envia ata por email a todos os participantes
9. Status muda para "concretizada", pautas ficam no historico
```

---

## 6. Estrutura de Ficheiros

```text
src/pages/Meetings.tsx              -- Lista de reunioes (reescrita)
src/pages/MeetingDetail.tsx         -- Detalhe/conducao da reuniao
src/pages/MeetingPublic.tsx         -- Pagina publica com timer
src/components/meetings/
  MeetingFormDialog.tsx             -- Dialog criar/editar reuniao
  MeetingTimer.tsx                  -- Timer com contagem regressiva
  AgendaCard.tsx                    -- Card de pauta individual
  AgendaInput.tsx                   -- Input para nova pauta
  ParticipantsList.tsx              -- Lista de participantes
src/hooks/useMeetings.ts            -- Hooks CRUD reunioes
supabase/functions/meeting-public/  -- Edge function dados publicos
supabase/functions/send-meeting-minutes/ -- Edge function envio ata
```

---

## Detalhes Tecnicos

- Realtime via `supabase.channel()` para `meeting_agendas` filtrado por `meeting_id`
- Timer usa `setInterval` com calculo baseado em `end_time - now()`
- Email da ata enviado via Resend usando `LOVABLE_API_KEY` (ja configurado)
- A pagina publica `/reuniao-publica/:id` nao requer login
- Rotas protegidas usam `ProtectedRoute` existente
- Multi-select de participantes usando checkboxes dentro de um Popover

