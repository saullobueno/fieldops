# Relatório da Fase 27

## Implementado

- `/despacho` ganhou um painel "Mapa do despacho" acima da fila e das faixas de técnicos.
- O mapa reaproveita `apps/web/src/lib/map-view.tsx` com MapLibre, evitando uma segunda integração cartográfica.
- `DispatchTechnicianLane` passou a expor `latitude`/`longitude` da base do técnico.
- `DispatchService` popula essas coordenadas tanto no caminho Postgres quanto no fallback demo.
- O mapa mostra:
  - bases dos técnicos com marcador `Tec <nome>`;
  - ordens pendentes com marcador do número da ordem.

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 106 testes, todos passando.
- `pnpm e2e`: 2 testes Playwright passando, incluindo o drag-and-drop do despacho após a inclusão do mapa.

## Decisões

- Nesta fase o mapa mostra localização dos técnicos pela base (`home_latitude`/`home_longitude`), não posição ao vivo, porque a localização em tempo real ainda não é persistida.
- Ordens atribuídas continuam representadas nas faixas, não no mapa, porque o contrato atual de `DispatchAssignmentCard` não carrega coordenadas do local.

## Limitações

- Sem rotas desenhadas entre técnico e ordem.
- Sem posição ao vivo do técnico no mapa do despacho.
- Sem clustering ou filtros geográficos; suficiente para o volume demo atual.
