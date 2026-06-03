## Parte 1 — Refatorar Notificações

### UI/UX no popover do sino (`AppLayout.tsx`)
- Reorganizar em **tabs**: Não lidas · Todas
- **Agrupar por tipo** (Faltas, Saídas antecipadas, Férias, Exames médicos, Reuniões, Sistema), cada grupo com ícone, cor e contagem
- **Filtro** por tipo (chips clicáveis no topo)
- Cada notificação: ícone com cor consistente, título, mensagem (2 linhas), tempo relativo PT, e — quando aplicável — botão "Abrir" que navega ao recurso (ex: ficha do colaborador, reunião)
- Ações: marcar individual como lida, marcar todas, **arquivar** (soft delete via novo campo `archived`), apagar (admin)
- Mostrar últimas 50 (em vez de 15), com botão "Ver mais" → nova página `/notificacoes`
- Toast em tempo real (subscrição Realtime) quando chega notificação nova enquanto o utilizador está logado

### Nova página `/notificacoes`
- Histórico completo paginado, filtros (tipo, lida/não lida, intervalo de datas, arquivada)
- Acessível a Admins e Gerentes

### Destinatários: incluir Gerentes
Hoje as notificações são uma fila global lida só por Admins. Vamos passar a fila a ser **direcionada**:

Migração:
- `admin_notifications.recipient_user_id uuid NULL` (NULL = broadcast para todos os admins, como hoje)
- `admin_notifications.archived boolean NOT NULL DEFAULT false`
- Índice `(recipient_user_id, read, created_at DESC)`
- Atualizar política RLS:
  - Admins veem tudo
  - Gerentes veem apenas as suas (`recipient_user_id = auth.uid()`) ou as do seu setor
- Atualizar Edge Functions que inserem notificações (`detect-absences`, `time-clock-punch` early leave, `auto-punch-cron`, lembretes de exames/inspeções) para também criar uma notificação dirigida ao **manager_id** do colaborador (além da existente broadcast para admins)

### Hook partilhado `useNotifications`
- Centraliza fetch, mark read, archive, contagem não-lidas, subscrição Realtime
- Usado pelo popover e pela página dedicada

---

## Parte 2 — Gravação e Transcrição IA de Reuniões

### Fluxo (gravação no browser + transcrição em lote)
1. Na página `/reunioes/:id` (apenas com reunião **em curso**), botão **"Iniciar Gravação"** usando `MediaRecorder` (webm/opus)
2. Indicador visual: tempo decorrido, nível de áudio, botão **Pausar/Retomar/Parar**
3. Ao parar: upload do blob para storage privado → chama Edge Function de transcrição
4. Após transcrição: chama Edge Function de resumo (Lovable AI/Gemini) que extrai decisões por pauta, ações e responsáveis sugeridos
5. Utilizador pode aceitar sugestões → preenchem automaticamente os campos `decision` das pautas existentes
6. Transcrição e resumo ficam guardados e visíveis numa nova aba "Transcrição" na página da reunião
7. Botão para **exportar PDF** (texto integral + resumo + decisões + oradores) e **TXT**

### Tabelas novas (migração)
- `meeting_recordings`
  - `meeting_id` (FK reuniões, cascade)
  - `storage_path` (audio no bucket)
  - `duration_seconds`, `mime_type`, `size_bytes`
  - `status` enum: `uploaded | transcribing | transcribed | failed`
  - `error_message`
  - `recorded_by` (uuid)
- `meeting_transcripts`
  - `meeting_id`, `recording_id` (FK)
  - `language_code`, `full_text` (TEXT)
  - `segments` (JSONB com `{ speaker, text, start, end }[]` — diarização)
  - `summary` (TEXT, gerado por IA)
  - `key_decisions` (JSONB `[{ agenda_id?, decision, responsible? }]`)
  - `action_items` (JSONB)
  - `model_used` (texto)
- GRANT + RLS: Admins gerem tudo; participantes da reunião podem ler

### Storage
- Novo bucket privado **`meeting-recordings`**
- Políticas em `storage.objects`: só admins fazem upload/leem; service_role total (Edge Functions)

### Edge Functions novas
- `meeting-transcribe` — recebe `recording_id`
  1. Marca recording como `transcribing`
  2. Cria signed URL do áudio, faz download
  3. Envia para **ElevenLabs Scribe v2** (`scribe_v2`) com `diarize=true`, `tag_audio_events=true`, `language_code=por`
  4. Persiste em `meeting_transcripts` (full_text + segments)
  5. Marca recording como `transcribed`
- `meeting-summarize` — recebe `transcript_id` + lista de pautas da reunião
  1. Chama Lovable AI Gateway com `google/gemini-3-flash-preview` (sem API key extra)
  2. Prompt estruturado: dado o transcript e as pautas, devolver `{ summary, decisions_per_agenda: [{agenda_id, decision, responsible_suggestion}], action_items }`
  3. Usa `response_format: json_object`
  4. Persiste no `meeting_transcripts`

### Segredo necessário
- `ELEVENLABS_API_KEY` — pedir ao utilizador via secrets tool antes de implementar a Edge Function de transcrição. `LOVABLE_API_KEY` já existe.

### UI nova
- `src/components/meetings/MeetingRecorder.tsx` — controlador de gravação (MediaRecorder), uploader, polling do estado de transcrição
- `src/components/meetings/MeetingTranscriptTab.tsx` — exibe segmentos com cores por orador, resumo, decisões sugeridas com botão "Aplicar à pauta X", botões de export PDF/TXT
- Tabs na `MeetingDetail.tsx`: **Pautas · Participantes · Transcrição**
- `src/lib/generateTranscriptPdf.ts` — PDF com jspdf usando a paleta do projeto

### Notificações ligadas
- Quando transcrição completa: notificação dirigida ao criador da reunião + admins ("Transcrição pronta para *Título*", link para a aba)
- Quando transcrição falha: notificação de erro

---

## Detalhes técnicos

- Reutiliza padrões existentes: `corsHeaders`, `createClient` com service role nas Edge Functions; `supabase.functions.invoke` no cliente
- Realtime: subscrição em `admin_notifications` (já habilitado) e em `meeting_recordings` (para refletir progresso da transcrição sem polling pesado)
- Sem alterações ao Banco de Horas, Fecho Mensal, férias coletivas, lógica de ponto
- Sem alterações ao tema (Professional Blue, Inter + Plus Jakarta Sans)
- Testes existentes (54) continuam a passar; sem reescrita de hooks de domínio

---

## Ordem de implementação
1. Migração: campos `recipient_user_id`/`archived`, tabelas `meeting_recordings`/`meeting_transcripts`, bucket + policies
2. Pedir `ELEVENLABS_API_KEY` ao utilizador
3. Hook `useNotifications` + refactor do popover + nova página `/notificacoes`
4. Atualizar Edge Functions que criam notificações para incluir gerente
5. Edge Function `meeting-transcribe` (ElevenLabs)
6. Edge Function `meeting-summarize` (Lovable AI)
7. Componentes `MeetingRecorder` + `MeetingTranscriptTab` + integração em `MeetingDetail`
8. PDF/TXT export
9. Verificar build, lint e testes