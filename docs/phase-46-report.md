# Fase 46 — Páginas de Mapa e Técnicos

## Contexto

Os itens "Mapa" e "Técnicos" existiam na sidebar desde a fundação do projeto, mas apontavam para `href="#"` — nunca ganharam página própria. "Calendário" também está nesse estado e permanece assim (ver Limitações).

## Entregue

- Backend: `GET /technicians` (`apps/api/src/modules/technicians`) lista técnicos da organização (nome, e-mail, status, habilidades, equipe, território, localização, atribuições ativas), com fallback demo. Protegido por `technician:read` (permissão já concedida a Admin/Despachante nos seeds).
- Backend: `GET /maps/overview` (`apps/api/src/modules/maps/map-overview.service.ts` + `maps.controller.ts`) retorna todos os técnicos e ordens de serviço ativas (status fora de `completed`/`cancelled`) com coordenadas, com fallback demo. Protegido por `schedule:read`.
- Novos tipos `TechnicianSummary`, `TechnicianListResponse`, `MapOverview*` em `packages/types`.
- Frontend: `/tecnicos` (busca por nome, filtro por status, tabela) e `/mapa` (mapa full-screen reaproveitando `MapView`, painel lateral com técnicos/ordens, atualização em tempo real via SSE).
- Sidebar: "Mapa" e "Técnicos" passaram a apontar para as páginas reais; "Calendário" ficou comentado no array `appShellNavItems` (decisão do usuário: página não é considerada prioritária frente ao que o despacho já cobre).

## Verificação

- `pnpm verify` (lint + typecheck de 13 pacotes + testes): passando.
- `pnpm vitest run apps/api/src/modules/dispatch apps/api/src/modules/maps apps/api/src/modules/customers apps/api/src/modules/technician`: 14 testes passando.
- Validação manual via Playwright contra a API/web local em modo demo: login, navegação para `/tecnicos` e `/mapa`, dados carregando sem erros de console.

## Limitações

- "Calendário" segue sem página própria (ver `docs/backlog.md` se uma futura fatia quiser endereçar).
- `/mapa` não tem clustering nem filtro geográfico — mesma limitação já registrada para o mapa do despacho (backlog, item fechado parcialmente na Fase 38).
