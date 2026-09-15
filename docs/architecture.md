# Arquitetura

## Monorepo

FieldOps usa pnpm workspaces com Turborepo. A fundação mantém cada futuro contexto delimitado em um pacote explícito para que as próximas fases adicionem comportamento sem mover regras de domínio para componentes de UI ou controllers.

## Aplicações

- `apps/web`: experiência desktop operacional para despachantes, gestores, administradores e visões voltadas a clientes.
- `apps/mobile-web`: app web responsivo focado no técnico para execução em campo offline-first.
- `apps/api`: backend NestJS. Controllers permanecem finos e delegam validação, autorização, decisões de domínio e persistência para pacotes/serviços.

## Packages

- `packages/config`: valida variáveis de ambiente nas fronteiras de processo.
- `packages/database`: centraliza a criação de clientes Postgres e Redis.
- `packages/domain`: futura casa da lógica pura de domínio e políticas determinísticas.
- `packages/auth`: futura casa de autenticação e autorização em nível de objeto.
- `packages/ui`: primitivas de UI compartilhadas.
- `packages/maps`, `packages/ai`, `packages/sync`, `packages/integrations`, `packages/types`: fronteiras explícitas para fases posteriores.

## Decisões da Fase 0

- TypeScript strict em todo o workspace.
- Configuração de runtime analisada com Zod antes do uso.
- Postgres e Redis configurados como dependências reais de infraestrutura via Docker Compose.
- Health checks divididos em liveness e readiness para a API inicializar de forma independente e ainda expor o status da infraestrutura.
- Testes não exigem Docker local, mantendo a verificação unitária rápida e determinística.

## Decisões da Fase 1

- O schema de domínio vive em `packages/database/src/schema.ts` e é exportado pelo cliente Drizzle.
- Tabelas operacionais carregam `organization_id` para suportar isolamento e autorização em nível de objeto.
- Regras puras de ciclo de vida ficam em `packages/domain`, não em controllers nem componentes.
- Migrações são geradas com `pnpm --filter @fieldops/database db:generate`.

## Decisões da Fase 2

- `packages/auth` concentra o catálogo de permissões e policies puras de autorização.
- A API usa um guard global que respeita metadados declarados com `RequirePermissions`.
- Até a autenticação real ser implementada, o ator pode ser injetado por headers `x-fieldops-*` em ambientes de desenvolvimento/teste.
