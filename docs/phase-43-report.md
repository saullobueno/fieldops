# Fase 43 — Pub/sub Redis para tempo real

## Entregue

- `RealtimeService` agora aceita `REDIS_CLIENT` opcional via infraestrutura da API.
- Publicações SSE continuam sendo emitidas localmente para baixa latência e também são publicadas em Redis quando disponível.
- Streams ativos assinam canais Redis por organização (`org:<organizationId>`), permitindo que múltiplas instâncias da API recebam o mesmo evento.
- O payload Redis inclui `sourceInstanceId`, então a instância que publicou ignora o próprio eco e evita duplicidade para o usuário conectado nela.
- Sem Redis, o comportamento anterior em memória permanece funcionando para demo/testes.

## Verificação

- `pnpm vitest run apps/api/src/modules/realtime`: 1 arquivo, 3 testes passando.
- `pnpm --filter @fieldops/api typecheck`: passando.

## Limitações

- Ainda falta validar contra um Redis real em ambiente de deploy, junto com o item de validação final de infraestrutura.
