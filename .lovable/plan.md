

# Gestao de EPIs, Ferramentas e Manutencoes

## Resumo
Criar tres modulos vinculados a funcionarios: (1) EPIs - registo de equipamentos de seguranca entregues, (2) Ferramentas - ferramentas da empresa sob responsabilidade do colaborador, (3) Manutencoes - tarefas de manutencao de maquinas com frequencia (diaria/semanal/mensal), templates de formulario por maquina, e notificacao automatica por email.

---

## 1. Base de Dados - Novas Tabelas

### `epi_deliveries` - Entregas de EPIs
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| employee_id | uuid FK employees | Colaborador |
| item_name | text | Nome do EPI (ex: Capacete, Luvas) |
| quantity | integer | Quantidade entregue |
| delivery_date | date | Data da entrega |
| expiry_date | date nullable | Validade do EPI |
| signed_file_url | text nullable | Comprovativo assinado |
| notes | text nullable | Observacoes |
| status | text | `delivered`, `returned`, `expired` |
| created_at | timestamptz | |

### `tool_assignments` - Ferramentas atribuidas
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| employee_id | uuid FK employees | Responsavel |
| tool_name | text | Nome da ferramenta |
| serial_number | text nullable | Numero de serie |
| assigned_date | date | Data de atribuicao |
| returned_date | date nullable | Data de devolucao |
| condition | text | `new`, `good`, `fair`, `damaged` |
| signed_file_url | text nullable | Comprovativo assinado |
| notes | text nullable | |
| status | text | `assigned`, `returned` |
| created_at | timestamptz | |

### `machines` - Registo de maquinas
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| name | text | Nome da maquina (ex: Compressor) |
| location | text nullable | Localizacao |
| description | text nullable | |
| checklist_template | jsonb | Template de campos do formulario de manutencao |
| created_at | timestamptz | |

### `maintenance_tasks` - Tarefas de manutencao recorrentes
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| machine_id | uuid FK machines | Maquina |
| employee_id | uuid FK employees | Responsavel |
| frequency | text | `daily`, `weekly`, `monthly` |
| day_of_week | integer nullable | 0-6 para weekly |
| day_of_month | integer nullable | 1-31 para monthly |
| title | text | Descricao da tarefa |
| is_active | boolean | Ativa ou nao |
| created_at | timestamptz | |

### `maintenance_logs` - Registos de manutencao realizados
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| task_id | uuid FK maintenance_tasks | Tarefa |
| employee_id | uuid FK employees | Quem fez |
| machine_id | uuid FK machines | Maquina |
| completed_date | date | Data de conclusao |
| checklist_data | jsonb | Formulario preenchido conforme template da maquina |
| notes | text nullable | Observacoes |
| status | text | `completed`, `pending`, `skipped` |
| created_at | timestamptz | |

### RLS em todas as tabelas:
- Admins podem gerir tudo (ALL)
- Funcionarios podem ver os seus proprios registos (SELECT com `can_access_employee`)

---

## 2. Nova Pagina: `/equipamentos`

Pagina com 3 tabs principais: **EPIs**, **Ferramentas**, **Manutencoes**

### Tab EPIs
- Botao "Registar Entrega"
- Tabela com: Funcionario, Item, Quantidade, Data Entrega, Validade, Status
- Acoes: PDF, Upload assinado, Eliminar
- Filtro por funcionario

### Tab Ferramentas
- Botao "Atribuir Ferramenta"
- Tabela com: Funcionario, Ferramenta, N Serie, Data Atribuicao, Condicao, Status
- Acoes: Marcar devolvida, PDF, Upload assinado, Eliminar

### Tab Manutencoes
- Sub-tabs: **Maquinas** | **Tarefas** | **Registos**
- **Maquinas**: CRUD de maquinas com template de checklist personalizavel (campos dinamicos tipo checkbox, texto, numero)
- **Tarefas**: Criar tarefa recorrente associando maquina + funcionario + frequencia
- **Registos**: Lista de manutencoes realizadas com formulario preenchido, filtro por maquina/funcionario/periodo

---

## 3. Template de Checklist por Maquina

O campo `checklist_template` em `machines` armazena um array JSON com a definicao dos campos:
```text
[
  { "field": "pressao_verificada", "label": "Pressao Verificada?", "type": "checkbox" },
  { "field": "nivel_oleo", "label": "Nivel de Oleo", "type": "select", "options": ["OK", "Baixo", "Critico"] },
  { "field": "observacoes", "label": "Observacoes", "type": "text" }
]
```

Quando o funcionario preenche a manutencao, um formulario dinamico e gerado a partir deste template.

---

## 4. Edge Function: `send-maintenance-reminder`

- Funcao que envia emails de lembrete automatico aos funcionarios com tarefas de manutencao previstas
- Consulta `maintenance_tasks` ativas, verifica a frequencia e se a proxima execucao e hoje
- Envia email para o `employee.email` com detalhes da maquina e tarefa
- Pode ser agendada via cron job (diario)

---

## 5. Portal do Funcionario

Atualizar `employee-portal` Edge Function e `EmployeePortal.tsx` para mostrar:
- EPIs recebidos
- Ferramentas sob responsabilidade
- Tarefas de manutencao pendentes com formulario de preenchimento

---

## 6. Perfil do Funcionario

Adicionar seccoes em `EmployeeProfile.tsx`:
- EPIs entregues
- Ferramentas atribuidas
- Historico de manutencoes realizadas

---

## 7. Navegacao

- Novo item no sidebar: "Equipamentos" com icone `HardHat` ou `Wrench`, rota `/equipamentos`
- Rota protegida em `App.tsx`

---

## 8. Ficheiros a Criar/Modificar

| Acao | Ficheiro |
|------|---------|
| Criar | Migracao SQL - 5 tabelas + RLS |
| Criar | `src/pages/Equipment.tsx` - Pagina principal com 3 tabs |
| Criar | `src/components/equipment/EpiFormDialog.tsx` |
| Criar | `src/components/equipment/ToolFormDialog.tsx` |
| Criar | `src/components/equipment/MachineFormDialog.tsx` |
| Criar | `src/components/equipment/MaintenanceTaskFormDialog.tsx` |
| Criar | `src/components/equipment/MaintenanceLogDialog.tsx` - Formulario dinamico |
| Criar | `src/components/equipment/ChecklistTemplateEditor.tsx` - Editor de template |
| Criar | `supabase/functions/send-maintenance-reminder/index.ts` |
| Modificar | `src/App.tsx` - Nova rota |
| Modificar | `src/components/layout/AppSidebar.tsx` - Novo menu |
| Modificar | `src/pages/EmployeeProfile.tsx` - Seccoes EPIs/Ferramentas/Manutencoes |
| Modificar | `src/pages/EmployeePortal.tsx` - Seccoes no portal |
| Modificar | `supabase/functions/employee-portal/index.ts` - Novos dados |
| Modificar | `supabase/config.toml` - Nova funcao |

