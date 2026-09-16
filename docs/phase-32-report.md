# Fase 32 — Troca Cloudflare R2 por Upstash Blob

## Entregue

- `packages/integrations`: `R2StorageAdapter` foi substituído por `UpstashBlobStorageAdapter`, mantendo o mesmo contrato `StorageAdapter` (`upload` + `getDownloadUrl`).
- `apps/api/src/modules/attachments`: o serviço de anexos agora lê `UPSTASH_BLOB_TOKEN`; sem essa variável, segue usando `ATTACHMENT_STORAGE_ROOT` local.
- `.env.example` e `.env`: removidos placeholders `R2_*` e adicionada a configuração `UPSTASH_BLOB_TOKEN`.
- `README.md` e `docs/backlog.md`: infraestrutura de referência atualizada para Upstash Redis + Upstash Blob.

## Decisão

- Upstash Blob substitui Cloudflare R2 porque o plano gratuito tem hard cap e não cobra automaticamente; cartão só é necessário ao migrar para pay-as-you-go.
- Bucket privado continua sendo a configuração recomendada, para preservar downloads por URL assinada.

## Verificação

- A executar: typecheck/testes focados de `@fieldops/integrations` e `AttachmentsService`.

## Limitações

- O caminho real contra Upstash Blob ainda precisa ser validado manualmente quando `UPSTASH_BLOB_TOKEN` for configurado em ambiente com rede.
- Upload offline de arquivos binários e barra de progresso permanecem no backlog.
