# Fase 44 — Validação real do OSRM

## Entregue

- `HttpMapsAdapter` foi exercitado contra o endpoint público `https://router.project-osrm.org`.
- A rota validada usou dois pontos reais em São Paulo:
  - origem: `-23.5452, -46.6339`
  - destino: `-23.5666, -46.6934`
- Resultado retornado:

```json
{
  "distanceMeters": 8182,
  "durationSeconds": 890,
  "provider": "osrm-http"
}
```

## Comando Usado

```bash
pnpm exec tsx -e "import { HttpMapsAdapter } from './packages/integrations/src/index.ts'; void (async () => { const adapter = new HttpMapsAdapter('https://router.project-osrm.org'); const result = await adapter.estimateRoute({ origin: { latitude: -23.5452, longitude: -46.6339 }, destination: { latitude: -23.5666, longitude: -46.6934 } }); console.log(JSON.stringify(result, null, 2)); })();"
```

## Decisão

- A validação real ficou registrada como fase manual, não como teste automatizado, para evitar que CI/local dev dependam de disponibilidade de rede pública.
- Para deploy, `MAPS_PROVIDER_BASE_URL=https://router.project-osrm.org` é suficiente para validar rotas reais sem chave de API.

## Limitações

- O endpoint público do OSRM é adequado para demonstração/portfólio, mas não é uma garantia operacional para produção de alto volume.
