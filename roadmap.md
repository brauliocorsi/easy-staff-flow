# Refatoração RH UP Móveis — roteiro

Snapshot auditado: f2ad0e93b744264861d6cded23073490b901396d
Regra transversal: não aprovar candidatos históricos, não recalcular saldos reais,
não lançar correções financeiras, não apagar registos, não enviar emails/notificações,
não publicar automaticamente. Histórico sempre consultável.

## Fase 1 — Motor de cálculo (CONCLUÍDA)
- [x] `src/lib/attendanceEngine.ts`: separa worked / défice bruto / candidatos de saída tardia /
      candidatos de entrada antecipada. Sem compensação interna.
- [x] Dias incompletos marcados para revisão, sem débito definitivo.
- [x] Part-time com uma picagem deixa de ser duplicado como entrada e saída.
- [x] Parâmetro explícito `tolerance_early_entry_minutes` (default 15), sem aprovação automática.
- [x] `attendanceReconciliation` passa a usar défice bruto + minutos já compensados.
- [x] OvertimeBank: saldo vem só de movimentos; diff do ponto passa a diagnóstico informativo.
- [x] Rótulos sem dupla sinalização ("+ +00:45").
- [x] 12 testes novos; 72 testes no total a passar.

## Fase 2 — Backup e segurança de base de dados (CONCLUÍDA)
- [x] Schema privado `backup_<data>` com cópia de time_clock_records, time_bank_movements,
      overtime_approvals, time_bank_monthly_closures, employee_schedules, schedule_templates
      e configuração do cron. Sem PIN/credenciais. GRANTs restritos, verificação de contagens.
- [x] Revogar EXECUTE de `cron_close_all_months` a anon/authenticated; validar chamador.
- [x] Encaminhar INSERT/UPDATE de `time_clock_records` por RPC controlada (relógio do servidor,
      sequência validada, idempotência anti-duplo-clique), mantendo acessos legítimos.

## Fase 3 — Cadeia de revisão e fecho (CONCLUÍDA, exceto painel legado)
- [x] RPC transacional de correção de ponto: motivo obrigatório, antes/depois, autor;
      recalcula candidatos pendentes, preserva decididos e sinaliza revisão.
- [x] Utilização de horas referencia ocorrência/dia e minutos compensados (idempotente).
- [x] Unificar `close_time_bank_month` numa implementação central; validar no servidor
      pendentes, ocorrências, mês terminado e mês anterior fechado.
- [x] Bloquear alterações/aprovações em mês fechado; reabertura nunca cancela pagamento real.
- [x] Cron deixa de forçar: prepara e sinaliza bloqueios, não fecha sem conciliação validada.
- [x] Painel de reconciliação legado somente leitura (divergências recalculadas em tempo real).

## Fase 4 — Horário e origem
- [x] Resolução central de horário: individual > template, com férias/feriados/ausências.
- [x] Auto-punch respeita férias/feriados/folgas.
- [x] Registar origem (manual/automática) e versão do horário a partir de agora.
- [x] UI reflete a regra efetiva de tolerância à saída antecipada (0) e entrada antecipada desde o 1.º minuto.
- [x] Turno noturno: validação explícita enquanto não modelado.

## Fase 5 — Interface premium
- [x] Tokens e tipografia: fundo #F6F7F9, superfícies brancas, carvão/azul profundo,
      vermelho UP como acento, estados em verde/âmbar/vermelho. Sem gradientes.
- [x] Shell: sidebar por domínios colapsável, cabeçalho com título/descrição/breadcrumb/ações.
- [x] Componentes partilhados: PageHeader, filtros, cartões de resumo, badges, tabelas,
      estados vazio/carregamento/erro, diálogos e confirmações.
- [~] Aplicar a todos os módulos: cabeçalho unificado em 17 páginas; falta trocar os
      estados de vazio/carregamento/erro locais pelos componentes partilhados em todas as rotas.
- [x] Ponto (próxima ação + aviso de picagem em falta), Banco, Aprovações (previsto vs real,
      entrada antecipada separada) e Fecho (lista de verificação).
- [~] Acessibilidade: contraste, teclado, foco, rótulos, tabelas responsivas.

## Por fazer (checkpoint)
- Substituir os blocos locais de vazio/carregamento/erro por `LoadingState`/`EmptyState`/`ErrorState`
  e as barras de filtro por `FilterBar` em todas as rotas.
- Inspeção visual autenticada (desktop e telemóvel) — sem sessão de teste disponível neste ambiente.
