# Relatório da Fase 28

## Implementado

- `technician_profiles` ganhou `current_latitude`/`current_longitude`/`location_updated_at`.
- `POST /realtime/technician-location` agora persiste a localização (via `RealtimeService.recordTechnicianLocation`) além de publicar o evento SSE; falha de persistência (modo demo/sem banco) não impede a publicação.
- `DispatchService` prioriza a localização atual do técnico (quando presente) sobre a base (`home_latitude`/`home_longitude`) tanto no mapa do despacho quanto na estimativa de deslocamento dos candidatos.
- `/despacho` e `/ordens` passaram a consumir `useRealtimeStream` (mesmo hook da Início) e invalidam suas queries do TanStack Query a cada evento recebido, além de exibir o badge de status da conexão (`RealtimeStatusBadge`, extraído para `apps/web/src/lib` e reaproveitado nas três páginas).

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 106 testes, todos passando.

## Decisões

- Localização atual sobrescreve a base sempre que presente, sem janela de "freshness" — mantém o comportamento simples; se a localização ficar visivelmente desatualizada em uso real, isso pode virar um refinamento futuro.
- Invalidação de queries em `/despacho` e `/ordens` segue o padrão já usado na Início (invalidar a cada evento recebido, sem filtrar por tipo), evitando lógica adicional de matching evento→query.

## Limitações

- Sem rotas desenhadas entre técnico e ordem (mantido do backlog).
- Sem clustering/filtros geográficos no mapa do despacho (mantido do backlog).
