# Relatório da Fase 33

## Implementado

- Alinhados os datasets demo de `DashboardService`, `DispatchService` e `WorkOrdersService` em torno da mesma ordem não atribuída (`WO-1003` / `demo-work-order-1003`, "Condomínio Jardim Sul"):
  - `dashboard.service.ts`: o item de maior risco de SLA (`slaRisk[0]`) agora é `WO-1003` (antes era `WO-1002`, que não tinha correspondente em `DispatchService`).
  - `work-orders.service.ts`: adicionada a `WO-1003` ao array demo de `WorkOrdersService`, que antes só tinha `WO-1001`/`WO-1002` — sem ela, `get_dispatch_candidates` nunca encontrava a ordem pelo número.
- Com isso, o encadeamento heurístico do copiloto (maior risco de SLA → localizar ordem → candidatos de despacho) consegue sugerir uma reatribuição em modo 100% demo, sem precisar de Postgres.

## Testes

- `apps/api/src/modules/copilot/copilot.service.test.ts`: o teste do caminho heurístico "sem chave de API" agora afirma que `suggestedAction.type` é `reassign_technician` (antes só verificava que a chamada não quebrava). O teste de rejeição "sem ação sugerida" foi reescrito para mockar explicitamente um cenário sem candidato (em vez de depender do encadeamento demo não bater, que agora sempre bate — o teste tinha um `if (recommendation.suggestedAction) return;` que ficaria sempre vazio).
- `pnpm verify`: lint + typecheck de 13 pacotes + 111 testes, todos passando.

## Decisões

- Não tentei alinhar TODOS os widgets demo do dashboard entre si (ex.: `dispatchPreview` e `activeServicesMap` já referenciam `WO-1003` com técnico/status diferentes) — cada widget do dashboard é uma fatia independente e propositalmente não normalizada; o problema real era só a cadeia sla-risk → candidatos de despacho usada pelo copiloto.
- `WO-1003` foi inserida no fim do array demo de `WorkOrdersService` (índice 2) para não alterar a ordem esperada pelos testes existentes (`items[0]?.number === "WO-1001"`).

## Limitações

- Nenhuma nova. Este item era puramente sobre consistência de dados demo.
