

## Plano: Sistema Completo de Advertencias

### Resumo

Transformar a pagina de advertencias em um sistema completo com: formulario de criacao detalhado, geracao de PDF para impressao/assinatura, upload do documento assinado, envio de e-mail ao colaborador, e contagem de advertencias vinculada ao registro do funcionario.

---

### 1. Tipos de Advertencia

- **Verbal** — apenas descricao, sem necessidade de documento assinado
- **Escrita** — gera PDF para impressao, requer assinatura e upload
- **Suspensao** — gera PDF, requer assinatura e upload, inclui periodo de suspensao
- **Demissao por justa causa** — gera PDF formal, requer assinatura e upload

---

### 2. Formulario de Nova Advertencia (WarningFormDialog)

Campos do formulario:
- Funcionario (select dos ativos)
- Tipo (verbal, written, suspension, termination)
- Motivo (texto curto obrigatorio)
- Descricao detalhada (textarea — corpo da advertencia)
- Data da advertencia
- Periodo de suspensao (inicio/fim) — visivel apenas para tipo "suspension"

Fluxo:
1. Admin preenche o formulario
2. Ao salvar, o registro e criado na tabela `warnings`
3. Se tipo != verbal: gera PDF automaticamente para download/impressao
4. Apos impressao e assinatura, o admin faz upload do documento assinado (campo `file_url`)
5. E-mail e enviado ao colaborador informando a advertencia

---

### 3. Geracao de PDF (generateWarningPdf)

Novo arquivo `src/lib/generateWarningPdf.ts` seguindo o padrao do `generateMeetingPdf.ts`:
- Cabecalho: "ADVERTENCIA DISCIPLINAR"
- Dados do funcionario (nome, cargo, departamento)
- Tipo da advertencia
- Data
- Motivo e descricao completa
- Campo para assinatura do colaborador (linha)
- Campo para assinatura do responsavel (linha)
- Rodape com data de geracao

---

### 4. Pagina de Advertencias (Warnings.tsx) — Reescrita completa

- Botao "Nova Advertencia" abre o WarningFormDialog
- Filtros: por funcionario e por tipo
- Tabela com colunas: Data, Funcionario, Tipo, Motivo, Documento, Acoes
- Coluna Documento: icone de download do PDF gerado + icone de upload/visualizacao do documento assinado
- Acoes: ver detalhes, carregar documento assinado, excluir (apenas admin)
- Cards de resumo no topo: total de advertencias, por tipo

---

### 5. Contagem no Registro de Funcionarios (Employees.tsx)

Adicionar coluna "Advertencias" na tabela de funcionarios (similar ao que ja existe para faltas):
- Badge com contagem total de advertencias
- Tooltip mostrando a distribuicao por tipo (verbal, escrita, suspensao, etc.)

---

### 6. Envio de E-mail ao Colaborador

Criar edge function `send-warning-email` que:
- Recebe `warning_id`
- Busca dados da advertencia + dados do funcionario
- Envia e-mail usando Resend (RESEND_API_KEY ja utilizado em send-meeting-minutes)
- Conteudo: tipo de advertencia, motivo, descricao, data

---

### 7. Upload de Documento Assinado

- Usar o bucket `documents` existente (ou criar `warnings` se preferir separacao)
- No card/linha da advertencia, botao "Carregar Assinatura" que permite upload de PDF/imagem
- Apos upload, atualiza `file_url` no registro da warning

---

### Detalhes Tecnicos

**Arquivos a criar:**
- `src/lib/generateWarningPdf.ts` — geracao do PDF de advertencia
- `src/components/warnings/WarningFormDialog.tsx` — formulario de criacao
- `supabase/functions/send-warning-email/index.ts` — envio de e-mail

**Arquivos a modificar:**
- `src/pages/Warnings.tsx` — reescrita completa com listagem, filtros e acoes
- `src/pages/Employees.tsx` — adicionar coluna de contagem de advertencias

**Tabela `warnings`** — ja existe com os campos necessarios (id, employee_id, type, reason, description, warning_date, file_url, issued_by). Nenhuma migracao necessaria.

**Storage** — reutilizar bucket `documents` existente para upload dos documentos assinados.

**Edge Function `send-warning-email`:**
- Verifica se RESEND_API_KEY existe nos secrets (verificar se ja esta configurado, caso contrario solicitar)
- Busca warning + employee do banco
- Envia e-mail HTML formatado ao e-mail do funcionario

