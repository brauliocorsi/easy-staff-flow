

# Sistema de Gestão de RH

## Visão Geral
Aplicação web completa para gestão de Recursos Humanos com design moderno e clean, 3 níveis de acesso (RH/Admin, Gestores e Funcionários) e backend com Supabase.

---

## 🔐 Autenticação e Perfis de Acesso

### 3 Níveis de acesso:
- **RH/Admin**: Acesso total ao sistema — cadastros, relatórios, configurações
- **Gestores**: Visualizam equipe, aprovam férias, registram advertências, conduzem reuniões
- **Funcionários**: Visualizam seus próprios dados, batem ponto, consultam documentos e holerites

### Login e Segurança
- Login com email e senha
- Página de recuperação de senha
- Perfis com foto, cargo e departamento

---

## 👥 Módulo de Funcionários

- Cadastro completo: dados pessoais, endereço, contato, cargo, departamento, data de admissão
- Upload de foto do funcionário
- Histórico de cargos e departamentos
- Status: ativo, férias, afastado, desligado
- Busca e filtros por departamento, cargo, status

---

## 📄 Módulo de Documentos e Contratos

- Upload e gestão de documentos (RG, CPF, carteira de trabalho, certificados)
- Contratos de trabalho com datas de início/fim, tipo (CLT, PJ, temporário)
- Aditivos contratuais
- Controle de vencimento de documentos com alertas visuais
- Download de documentos pelo funcionário (seus próprios)

---

## ⏰ Relógio de Ponto

### Sistema de Ponto via Web:
- Página pública com cards dos funcionários
- Funcionário seleciona seu card e digita PIN pessoal para registrar ponto
- Registro de entrada, saída para almoço, retorno do almoço e saída
- Visualização do ponto do dia em tempo real

### Gestão do Ponto:
- Relatórios diários, semanais e mensais de horas
- Cálculo automático de horas trabalhadas e extras
- Aprovação/ajuste de ponto pelo RH
- Exportação de relatórios

---

## ⚠️ Módulo de Advertências

- Registro de advertências verbais e escritas
- Vinculação ao funcionário com data, motivo e descrição
- Upload de documento assinado
- Histórico de advertências por funcionário
- Níveis: advertência verbal → escrita → suspensão

---

## 🏖️ Mapa de Férias

- Calendário visual com férias planejadas e aprovadas
- Solicitação de férias pelo funcionário
- Aprovação pelo gestor/RH
- Controle de período aquisitivo e saldo de dias
- Visão por departamento para evitar conflitos de agenda
- Alertas de férias vencidas

---

## 📋 Registro de Faltas

- Registro de faltas justificadas e injustificadas
- Upload de atestados médicos e justificativas
- Relatórios de absenteísmo por funcionário e departamento
- Impacto automático no controle de ponto

---

## 🤝 Módulo de Reuniões

### Agendamento e Gestão:
- Criar reunião com título, data/hora, participantes e pautas
- Cronômetro de tempo corrido visível durante a reunião
- Registro de decisões e encaminhamentos por pauta
- Status: agendada, em andamento, concluída

### Envio Automático por Email:
- Convite de reunião enviado automaticamente aos participantes
- Ata com pautas e decisões enviada por email após conclusão
- Integração com serviço de email (Resend)

---

## 📊 Dashboard Principal

- Visão geral: total de funcionários, aniversariantes do mês, férias em andamento
- Gráficos de faltas e horas extras
- Alertas: documentos vencendo, férias vencidas, advertências recentes
- Acesso rápido aos módulos

---

## 🛠️ Tecnologias

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (banco de dados, autenticação, storage para documentos, edge functions)
- **Email**: Resend para envio de pautas de reunião
- **Gráficos**: Recharts para dashboards

