# Relatório da Fase 0

## Implementado

- Estrutura de workspace pnpm/Turborepo.
- Configuração TypeScript strict compartilhada.
- Configuração raiz de ESLint e Vitest.
- Shells Next.js para web e mobile web.
- Shell da API NestJS com endpoints de liveness e readiness.
- Validação de ambiente com Zod.
- Fábricas de conexão para Postgres e Redis.
- Docker Compose para infraestrutura local.
- CI com GitHub Actions.

## Decisões

- Readiness faz ping na infraestrutura, mas testes unitários simulam o comportamento de conexão para permanecerem determinísticos.
- Fronteiras de pacote existem antes da implementação de domínio para evitar vazamento de regras para UI/API nas próximas fases.
- Nenhuma entidade de domínio de produção foi implementada na Fase 0.

## Testes

- `pnpm verify`: passou com lint, typecheck dos 13 workspaces e 2 testes.
- `pnpm build`: passou com 13 tarefas, incluindo build de produção dos apps Next.js.

## Limitações

- Schema de banco e migrations começam na Fase 1.
- Autenticação e autorização começam na Fase 2.
- Realtime, offline e simulação demo estão intencionalmente ausentes até suas fases planejadas.
