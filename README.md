# FieldOps

FieldOps é uma plataforma de operações de serviços em campo estruturada como monorepo pnpm/Turborepo.

## Escopo da Fase 0

Este repositório contém apenas a fundação neste momento:

- `apps/web`: shell desktop de despacho/administração com Next.js.
- `apps/mobile-web`: shell mobile web do técnico com Next.js.
- `apps/api`: shell da API NestJS com health checks.
- `packages/config`: validação tipada de ambiente com Zod.
- `packages/database`: fábricas de conexão para Postgres e Redis.
- `packages/ui`: primitivas React compartilhadas.
- `packages/domain`, `packages/auth`, `packages/maps`, `packages/ai`, `packages/sync`, `packages/integrations`, `packages/types`: fronteiras tipadas para fases posteriores.
- Docker Compose para Postgres e Redis.
- Configuração de CI, lint, typecheck e Vitest.

Modelos de domínio e workflows de produção começam na Fase 1.

## Como Rodar

A infraestrutura de referência do projeto usa apenas serviços com camada gratuita: [Neon](https://neon.tech) (Postgres), [Upstash](https://upstash.com) (Redis), [Vercel](https://vercel.com) (`apps/web` e `apps/mobile-web`), [Render](https://render.com) (`apps/api`) e [Groq](https://groq.com) (copiloto de IA). Não é necessário Docker para desenvolver.

1. Instale as dependências:

   ```bash
   pnpm install
   ```

2. Copie o template de ambiente:

   ```bash
   cp .env.example .env
   ```

3. Preencha `DATABASE_URL` com a connection string do seu projeto Neon (inclui `sslmode=require`) e `REDIS_URL` com a connection string `rediss://` do seu banco Upstash. Ambos os clientes (`pg`, `ioredis`) já reconhecem essas URLs sem configuração adicional.

4. Rode os apps:

   ```bash
   pnpm dev
   ```

### Alternativa: infraestrutura local via Docker

Para quem preferir não depender de contas externas durante o desenvolvimento, `docker-compose.yml` sobe um Postgres e um Redis locais equivalentes:

```bash
docker compose up -d
```

Nesse caso, use os valores padrão de `DATABASE_URL`/`REDIS_URL` já presentes em `.env.example` (apontando para `localhost`).

## Verificação

Rode a suíte completa de verificação da Fase 0:

```bash
pnpm verify
```

Os endpoints de saúde da API são:

- `GET /health`
- `GET /health/readiness`

O endpoint de readiness faz ping no Postgres e no Redis usando a configuração de ambiente validada.

## Banco de Dados

O schema Drizzle fica em `packages/database/src/schema.ts`.

Para gerar migrações depois de alterar o schema:

```bash
pnpm --filter @fieldops/database db:generate
```

Para aplicar migrações no banco configurado em `DATABASE_URL`:

```bash
pnpm --filter @fieldops/database db:migrate
```

Para popular o modo demo determinístico:

```bash
pnpm --filter @fieldops/database seed:demo
```
