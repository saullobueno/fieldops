# Relatório da Fase 38

## Implementado

- `MapView` (`apps/web/src/lib/map-view.tsx`) ganhou suporte a `routes` (segmentos de linha via GeoJSON `LineString`, camada `line` do MapLibre com traço tracejado), além dos marcadores já existentes.
- `/despacho`: enquanto uma ordem não atribuída está sendo arrastada, o mapa desenha uma linha reta da base de cada técnico até a ordem sendo arrastada — apoio visual para a mesma pontuação/deslocamento que já aparece nos cartões dos técnicos durante o drag.

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 112 testes, todos passando.
- `pnpm e2e`: 2 testes Playwright passando, incluindo o drag-and-drop do despacho (não quebrou com a nova prop `routes`).
- Verificação manual: simulei um drag real via Playwright e confirmei que o texto "Arraste em andamento: linhas mostram a distância até cada técnico" aparece corretamente (ou seja, `routes` é calculado e passado ao `MapView` sem erros de runtime). Não foi possível confirmar visualmente o traçado das linhas por pixel porque o ambiente de teste não tem acesso à internet para o provedor de tiles do mapa — limitação do ambiente, não do código.

## Decisões

- As linhas são retas ("a vol de pássaro"), não uma rota real seguindo ruas — desenhar a rota real exigiria consultar `HttpMapsAdapter`/OSRM uma vez por candidato durante o drag (uma chamada de rede por técnico a cada início de arraste), o que é mais custoso e não estava claramente pedido pelo item do backlog. A linha reta já comunica visualmente "quem está mais perto" de forma consistente com o `estimatedTravelMinutes` que já é mostrado nos cartões.
- Não implementei clustering nem filtros geográficos nesta fatia — ambos fazem mais sentido com um volume de dados maior que o do dataset demo atual; ver observação no backlog.

## Limitações

- Sem clustering ou filtros geográficos no mapa do despacho (mantido como limitação conhecida).
- Linhas mostram distância "reta", não a rota real por ruas.
