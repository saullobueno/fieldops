# Relatório — Roadmap Fase 10: Relatórios

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre, seguindo o padrão dos relatórios anteriores (`roadmap-fase-06` a `roadmap-fase-09`).

## Implementado

- `packages/domain`: `calculateSlaComplianceRate` — função pura que calcula o percentual de cumprimento de SLA com uma casa decimal, testada isoladamente (inclusive o caso de zero ordens mensuráveis).
- API — módulo `reports`: `GET /reports/overview?from&to&teamId&territoryId`, protegido por `report:read`, retornando:
  - KPIs: total de ordens, ordens concluídas, percentual de cumprimento de SLA, tempo médio de resolução em minutos.
  - Série de ordens por status, volume diário de ordens, cumprimento de SLA por equipe (dentro/fora do prazo) e ordens concluídas por técnico.
  - Filtros por intervalo de datas (obrigatório na consulta SQL, com padrão de 30 dias quando não informado), equipe e território, com fallback determinístico em memória quando não há Postgres.
- `apps/web`: nova página `/relatorios` com filtros (data inicial/final, equipe, território), quatro cartões de KPI e quatro visualizações ECharts (pizza de status, barras de volume diário, barras empilhadas de cumprimento de SLA por equipe, barras de ordens concluídas por técnico). `echarts` foi adicionado como dependência do `apps/web` — é a biblioteca de visualização já prevista na arquitetura alvo do prompt mestre e não havia sido instalada em nenhuma fase anterior.
- Link "Relatórios" do `AppShell` agora aponta para `/relatorios`.

## Testes

- Testes unitários novos em `packages/domain` para `calculateSlaComplianceRate` (cálculo com casa decimal, zero mensuráveis, 100%).
- Teste unitário novo para `ReportsService` (modo demo retorna KPIs e todas as séries preenchidas).
- `pnpm typecheck` (13 pacotes) e `pnpm test` (58 testes, 18 arquivos) executados com sucesso.
- `eslint` limpo nos arquivos novos/alterados.
- Verificação manual ponta a ponta: subi a API já em execução (hot-reload) e confirmei via `curl` que `GET /reports/overview` aplica o intervalo padrão de 30 dias quando nenhuma data é informada, aceita filtro de equipe, e rejeita data em formato inválido com 400. A página `/relatorios` retorna 200 e o log de desenvolvimento do Next.js (`.next/dev/logs/next-development.log`) confirma compilação limpa da rota, sem entradas de erro — mesmo mecanismo que expôs os bugs reais encontrados na Fase 7.

## Decisões

- Um bug de SQL foi identificado e corrigido durante a implementação (antes de qualquer teste): a consulta de utilização por técnico originalmente tinha duas cláusulas `where` na mesma query (uma vinda do helper compartilhado `fromClause`, outra adicionada manualmente para filtrar técnicos sem nome). Corrigido unificando a condição extra dentro do parâmetro passado ao helper.
- A dimensão de data usada em todas as agregações é `wo.scheduled_start_at` (mesma coluna já usada pelo despacho e pelo dashboard), mantendo consistência entre as telas em vez de introduzir `created_at` como uma segunda noção de "quando a ordem aconteceu".
- Equipe/território como filtro reaproveitam a mesma lógica de escopo já usada no despacho e nos relatórios de dashboard (técnico ativo da ordem via `work_order_assignments` + `technician_profiles`), sem introduzir um novo conceito de agrupamento.
- Os seletores de equipe/território na UI são uma lista fixa (mesmos dois times/territórios do seed demo), já que não existe endpoint de listagem de equipes/territórios no projeto ainda — consistente com o mesmo atalho pragmático usado em outras telas para os headers de ator demo.

## Limitações

- Os filtros de equipe/território na UI usam uma lista fixa em vez de consultar um endpoint real de equipes/territórios (que não existe ainda). Fechamento: quando houver um módulo de administração de equipes/territórios.
- Não há exportação do relatório (CSV/PDF) nem impressão formatada — só visualização na tela.
- O tempo médio de resolução usa `scheduled_start_at` até `completed_at` como proxy; não diferencia tempo de deslocamento de tempo de execução no local (dado que o schema não registra o momento exato de chegada separadamente do `on_site`).

## Próxima fase

Fase 11 do roadmap mestre (Tempo Real): eventos tipados WebSocket/SSE para estado dos serviços, atribuições, presença/localização dos técnicos e notificações — ainda não iniciada.
