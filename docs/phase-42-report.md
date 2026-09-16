# Fase 42 — Preparação para deploy real

## Entregue

- API: CORS deixou de ficar preso a `localhost` e passou a usar `CORS_ALLOWED_ORIGINS`.
- API: `main.ts` agora respeita `PORT` quando a plataforma de deploy fornece essa variável, mantendo `API_PORT` como fallback local.
- Web: `useRealtimeStream` deixou de chamar `http://localhost:4000` diretamente e passou a montar a URL a partir de `NEXT_PUBLIC_API_BASE_URL`.
- Configuração: `.env.example` documenta `CORS_ALLOWED_ORIGINS`.
- Documentação: novo roteiro `docs/deploy-free-tier.md` com serviços, variáveis, comandos e checklist de validação.

## Verificação pendente

- Validar Render/Vercel/Neon/Upstash em ambiente real com URLs e tokens finais.
- Confirmar upload real no Upstash Blob.
- Confirmar `GET /health/readiness` contra Neon + Upstash Redis.

## Próximo passo

- Criar os serviços gratuitos e preencher as variáveis de ambiente finais. Depois disso, executar a validação ponta a ponta e fechar o item 37 do backlog.
