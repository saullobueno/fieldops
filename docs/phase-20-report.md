# Relatório da Fase 20

## Implementado

- Documentação do fluxo de desenvolvimento sem Docker: README agora recomenda Neon (Postgres) e Upstash (Redis) como infraestrutura padrão, com o Docker Compose local mantido como alternativa opcional.
- `.env.example` ganhou comentários explicando as duas opções para `DATABASE_URL`/`REDIS_URL` (local via Docker vs. Neon/Upstash), sem alterar os valores padrão de desenvolvimento local.
- `.env.example` ganhou placeholders vazios (documentação de formato, sem valores reais) para as próximas integrações gratuitas já decididas: `GROQ_API_KEY` (copiloto), `NEXT_PUBLIC_MAPTILER_KEY` (mapa real) e credenciais do Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) para anexos.

## Testes

- Nenhum código de aplicação foi alterado nesta fatia (só documentação/template de ambiente); não havia teste a rodar.

## Decisões

- Não houve mudança de código em `packages/database`: `createPostgresPool` já aceita qualquer connection string via `pg`, que reconhece `sslmode=require` automaticamente (confirmado via `pg-connection-string`) — connection strings do Neon funcionam sem alteração. `createRedisClient` já aceita qualquer URL via `ioredis`, que ativa TLS automaticamente para o esquema `rediss://` usado pelo Upstash — sem alteração necessária.
- `docker-compose.yml` foi mantido (não removido) porque o repositório não tem controle de versão configurado ainda; preferi manter a opção reversível de desenvolvimento 100% local em vez de apagar um arquivo funcional.
- Valores reais de credenciais (Neon, Upstash, Groq, MapTiler, R2) ficam para quando o usuário configurar as respectivas contas — combinado explicitamente como a última etapa do plano de trabalho.

## Limitações

- As variáveis novas (`GROQ_API_KEY`, `NEXT_PUBLIC_MAPTILER_KEY`, `R2_*`) ainda não são lidas por nenhum código além do copiloto (`GROQ_API_KEY`, já implementado na Fase 19); mapa real e storage em nuvem são fatias de trabalho futuras.
- Não há ainda `render.yaml`/`vercel.json` de deploy — isso fica para a fatia de configs de deploy, mais adiante no plano combinado.
- Sem repositório git inicializado neste projeto, não há histórico para reverter mudanças de arquivo com segurança; vale considerar `git init` antes de operações mais arriscadas.
