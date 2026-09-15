# Relatório da Fase 22

## Implementado

- Mapa real no widget "Mapa ativo" do Início, substituindo os pontos posicionados por percentual (`index * 24%`) que ignoravam `latitude`/`longitude` reais já retornados pela API.
- `apps/web/src/lib/map-view.tsx`: componente `MapView` com MapLibre GL, marcadores plotados pelas coordenadas reais de cada ordem, `fitBounds` automático para enquadrar todos os pontos (ou `setCenter`/zoom quando há só um).
- Estilo de tiles: usa o estilo público `demotiles.maplibre.org` (sem chave) por padrão, e troca automaticamente para o MapTiler (free tier, `streets-v2`) quando `NEXT_PUBLIC_MAPTILER_KEY` estiver definida — decisão já documentada em `.env.example` na Fase 20.
- Marcadores coloridos por tom: vermelho quando a ordem está com status `requires_review`, verde nos demais.

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 93 testes, todos passando (nenhum teste automatizado novo — `MapView` é um wrapper fino de biblioteca de terceiros sobre uma API DOM/canvas, sem lógica de domínio testável isoladamente; a lógica que já tinha teste, como o cálculo de risco de SLA que alimenta este widget, não mudou).
- `pnpm --filter @fieldops/web build`: build de produção confirmando que o Turbopack processa o import do CSS do `maplibre-gl` sem erro e todas as rotas continuam gerando estaticamente.
- **Não houve verificação visual interativa em navegador** nesta fatia (sem ferramenta de browser disponível na sessão) — apenas typecheck/build. Recomenda-se abrir `/` localmente e confirmar que o mapa renderiza tiles e marcadores antes de considerar esta fatia visualmente validada.

## Decisões

- `maplibre-gl` (`^6.9.1`) adicionado só em `apps/web` (não em `packages/ui`), porque hoje só o dashboard usa mapa; evita inflar o bundle do `apps/mobile-web`, que não tem mapa.
- Import do namespace inteiro (`import * as maplibregl from "maplibre-gl"`) em vez de `import maplibregl from`, porque a v6 da lib não tem export default (typecheck falhou com `TS1192` até essa correção).
- Fallback de estilo sem chave (`demotiles.maplibre.org`) escolhido para o mapa já funcionar visualmente antes de qualquer configuração de conta — consistente com a orientação do usuário de deixar a configuração de variáveis de ambiente reais por último.

## Limitações

- Console de Despacho continua sem nenhuma visualização de mapa (nunca teve, nem fake) — ver item 30 do backlog, é a próxima fatia natural reaproveitando o mesmo `MapView`.
- Sem rotas desenhadas no mapa (linhas de deslocamento técnico → local); `HttpMapsAdapter`/OSRM calcula tempo de deslocamento no despacho, mas isso não é visualizado geograficamente em lugar nenhum ainda.
- Localização ao vivo do técnico (Fase 11) continua não persistida nem plotada no mapa — ver item 22 pré-existente do backlog.
