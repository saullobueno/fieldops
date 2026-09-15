# Relatório da Fase 14

## Implementado

- Dashboard agora consulta PostgreSQL quando há pool disponível e ator autenticado.
- Widgets persistentes para KPIs, despacho, risco de SLA, mapa, ordens recentes, utilização e insights.
- Fallback demo preservado para testes e execução local sem banco.
- Controller do dashboard passou a escopar dados pela organização do ator.

## Testes

- Testes unitários do dashboard atualizados para fluxo assíncrono.
- Typecheck focado de `@fieldops/api` executado com sucesso.

## Decisões

- Consultas usam SQL parametrizado e escopo por `organization_id`.
- Insights persistentes são derivados de SLA e utilização enquanto a camada de IA real não existe.

## Limitações

- Métricas avançadas de tempo médio de resposta e resolução na primeira visita ainda não usam eventos históricos completos.
- Não há cache materializado para widgets pesados.
