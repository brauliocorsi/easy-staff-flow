

# Controlo de Veiculos da Empresa

## Resumo
Criar um modulo completo de gestao de frota de veiculos, com registo de veiculos, controlo de vencimentos de seguros e inspecoes, lembretes automaticos, e historico de manutencoes realizadas.

---

## 1. Base de Dados - Novas Tabelas

### `vehicles` - Registo de veiculos
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| plate | text NOT NULL | Matricula |
| brand | text | Marca (ex: Renault) |
| model | text | Modelo (ex: Clio) |
| year | integer | Ano |
| color | text | Cor |
| vin | text | Numero de chassi |
| fuel_type | text | Tipo combustivel (gasoline/diesel/electric/hybrid) |
| km_current | integer | Quilometragem atual |
| assigned_employee_id | uuid FK employees nullable | Funcionario responsavel |
| status | text | active, inactive, sold |
| notes | text nullable | |
| created_at | timestamptz | |

### `vehicle_documents` - Seguros e Inspecoes
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| vehicle_id | uuid FK vehicles | |
| type | text | insurance, inspection, other |
| description | text | Descricao (ex: Seguro contra todos os riscos) |
| provider | text nullable | Seguradora / Centro de inspecao |
| start_date | date | Data inicio |
| expiry_date | date | Data de vencimento |
| cost | numeric nullable | Custo |
| file_url | text nullable | Documento anexo |
| reminder_days | integer default 30 | Dias antes do vencimento para lembrete |
| status | text | active, expired, renewed |
| notes | text nullable | |
| created_at | timestamptz | |

### `vehicle_maintenances` - Manutencoes realizadas e previstas
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| vehicle_id | uuid FK vehicles | |
| type | text | preventive, corrective |
| description | text | Descricao da manutencao |
| maintenance_date | date | Data |
| next_maintenance_date | date nullable | Proxima manutencao prevista |
| next_maintenance_km | integer nullable | KM da proxima manutencao |
| km_at_maintenance | integer nullable | KM no momento |
| cost | numeric nullable | Custo |
| provider | text nullable | Oficina |
| invoice_url | text nullable | Fatura |
| parts_replaced | text nullable | Pecas substituidas |
| performed_by | uuid FK employees nullable | Quem realizou/reportou |
| status | text | completed, scheduled, cancelled |
| notes | text nullable | |
| created_at | timestamptz | |

### RLS em todas as tabelas:
- Admins: ALL
- Todos os autenticados: SELECT (visualizar)

---

## 2. Nova Pagina: `/veiculos`

Pagina com 3 tabs: **Veiculos**, **Documentos (Seguros/Inspecoes)**, **Manutencoes**

### Tab Veiculos
- Tabela com: Matricula, Marca/Modelo, Ano, KM, Responsavel, Status
- Botao "Adicionar Veiculo"
- Acoes: Editar, Eliminar
- Cards resumo no topo: Total veiculos, Seguros a vencer (30 dias), Inspecoes a vencer (30 dias)

### Tab Documentos (Seguros e Inspecoes)
- Tabela com: Veiculo, Tipo, Descricao, Seguradora, Validade, Status, Custo
- Filtro por veiculo e por tipo (seguro/inspecao)
- Badge de alerta para documentos proximos do vencimento ou expirados
- Botao "Adicionar Documento"
- Acoes: Upload ficheiro, Eliminar

### Tab Manutencoes
- Tabela com: Veiculo, Tipo, Descricao, Data, KM, Custo, Proxima Manutencao, Status
- Filtro por veiculo
- Botao "Registar Manutencao"
- Acoes: Eliminar

---

## 3. Edge Function: `send-vehicle-reminders`

- Consulta `vehicle_documents` com `expiry_date` nos proximos X dias (conforme `reminder_days`)
- Consulta `vehicle_maintenances` com `next_maintenance_date` proxima
- Envia email ao administrador ou responsavel do veiculo com os alertas
- Pode ser agendada via cron job diario

---

## 4. Navegacao e Rotas

- Novo item no sidebar: "Veiculos" com icone `Car`
- Nova rota protegida `/veiculos` em `App.tsx`

---

## 5. Ficheiros a Criar/Modificar

| Acao | Ficheiro |
|------|---------|
| Criar | Migracao SQL - 3 tabelas + RLS |
| Criar | `src/pages/Vehicles.tsx` - Pagina principal com 3 tabs |
| Criar | `src/components/vehicles/VehicleFormDialog.tsx` - Formulario veiculo |
| Criar | `src/components/vehicles/VehicleDocumentFormDialog.tsx` - Formulario seguro/inspecao |
| Criar | `src/components/vehicles/VehicleMaintenanceFormDialog.tsx` - Formulario manutencao |
| Criar | `supabase/functions/send-vehicle-reminders/index.ts` - Lembretes |
| Modificar | `src/App.tsx` - Nova rota `/veiculos` |
| Modificar | `src/components/layout/AppSidebar.tsx` - Novo menu "Veiculos" |
| Modificar | `supabase/config.toml` - Nova funcao (automatico) |

---

## 6. Detalhes Tecnicos

- Seguir padrao existente do modulo de Equipamentos (queries com `useQuery`, dialogs com shadcn/ui, mutations com `useQueryClient`)
- Tabelas com `as any` cast para tipos nao gerados (padrao existente)
- Badges de alerta: vermelho para expirado, amarelo para "a vencer em X dias"
- Upload de ficheiros no bucket `equipment` existente (ou criar bucket `vehicles`)
- Cron job para lembretes segue o padrao do `send-maintenance-reminder`

