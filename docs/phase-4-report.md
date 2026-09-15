# Relatório da Fase 4

## Implementado

- Endpoint protegido `GET /dashboard/widgets/:widget` com validação Zod de widget e limite.
- Serviço de dashboard com dados determinísticos para KPIs, prévia do despacho, fila de SLA, mapa ativo, ordens recentes, utilização e insights.
- Dashboard inicial no `apps/web` em português-BR.
- TanStack Query para estado de servidor no frontend.
- Estados independentes de carregamento, erro, vazio e retry por widget.

## Testes

- Testes unitários do serviço de dashboard.

## Decisões

- Widgets usam limites explícitos e payloads discriminados.
- O frontend consome a API protegida usando headers de ator demo até a autenticação real evoluir.
- A navegação principal permanece apenas na sidebar, sem duplicação dentro das páginas.

## Limitações

- Os dados do dashboard ainda são determinísticos em memória; consultas reais entram quando os repositórios de leitura forem adicionados.
- O mapa é uma prévia visual sem provedor cartográfico real nesta fase.
