# Deploy gratuito — checklist

Este roteiro prepara a validação real do FieldOps usando serviços com camada gratuita e sem Cloudflare R2.

## Serviços

- Neon: Postgres (`DATABASE_URL` com `sslmode=require`).
- Upstash Redis: Redis (`REDIS_URL` com `rediss://`).
- Upstash Blob: anexos (`UPSTASH_BLOB_TOKEN`, bucket privado recomendado).
- Groq: copiloto real (`GROQ_API_KEY`).
- OSRM público ou instância própria: rotas (`MAPS_PROVIDER_BASE_URL`).
- Vercel: `apps/web` e `apps/mobile-web`.
- Render: `apps/api`.

## API no Render

Configure um Web Service apontando para este repositório.

- Build command: `pnpm install --frozen-lockfile --prod=false && pnpm --filter @fieldops/api build`
- Start command: `pnpm --filter @fieldops/api start:render`
- Health check path: `/health`

Variáveis:

- `NODE_ENV=production`
- `DATABASE_URL=<Neon connection string>`
- `REDIS_URL=<Upstash Redis rediss URL>`
- `FIELDOPS_SESSION_SECRET=<segredo aleatorio com 32+ caracteres>`
- `ATTACHMENT_URL_SECRET=<segredo aleatorio com 32+ caracteres>`
- `CORS_ALLOWED_ORIGINS=<url-web-vercel>,<url-mobile-vercel>`
- `GROQ_API_KEY=<opcional>`
- `UPSTASH_BLOB_TOKEN=<opcional>`
- `MAPS_PROVIDER_BASE_URL=https://router.project-osrm.org`
- `SENTRY_DSN=<opcional>`

O Render fornece `PORT`; a API usa essa variável automaticamente quando presente. O comando `start:render` roda a API via `tsx` para resolver corretamente os packages TypeScript do monorepo em runtime.

## Web e Mobile Web na Vercel

Crie dois projetos Vercel usando o mesmo repositório.

Web desktop:

- Root directory: `apps/web`
- Build command: `pnpm --filter @fieldops/web build`
- Output: padrão Next.js
- Variáveis: `NEXT_PUBLIC_API_BASE_URL=<url-publica-api-render>` e, opcionalmente, `NEXT_PUBLIC_MAPTILER_KEY=<chave>`

Mobile web:

- Root directory: `apps/mobile-web`
- Build command: `pnpm --filter @fieldops/mobile-web build`
- Output: padrão Next.js
- Variável: `NEXT_PUBLIC_API_BASE_URL=<url-publica-api-render>`

Depois que as URLs Vercel existirem, volte no Render e atualize `CORS_ALLOWED_ORIGINS` com as duas URLs finais.

## Banco

Depois de configurar `DATABASE_URL` localmente ou em um ambiente com acesso ao Neon:

```bash
pnpm --filter @fieldops/database db:migrate
pnpm --filter @fieldops/database seed:demo
```

## Validação manual

- `GET <api>/health` deve responder `ok`.
- `GET <api>/health/readiness` deve conseguir pingar Postgres e Redis.
- Login no web com `admin@acmefield.example` / `demo1234`.
- Abrir `/despacho`, `/ordens`, `/clientes`, `/relatorios`, `/copilot`.
- Testar upload de anexo com `UPSTASH_BLOB_TOKEN` configurado.
- Fazer uma pergunta no copiloto e confirmar `source: "groq"` na resposta da API ou na tela.

## O que preciso de você para validar daqui

Quando quiser que eu execute a validação final, me envie apenas estes valores, sem cartões ou dados sensíveis além dos tokens do próprio projeto:

- URL pública da API no Render.
- URLs públicas dos dois apps na Vercel.
- `DATABASE_URL` do Neon.
- `REDIS_URL` do Upstash Redis.
- `UPSTASH_BLOB_TOKEN`, se quiser validar anexos em nuvem.
- Confirmação de que `GROQ_API_KEY` está configurada no ambiente onde a API roda.
