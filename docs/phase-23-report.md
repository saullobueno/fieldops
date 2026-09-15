# Relatório da Fase 23

## Implementado

- Upload real de anexos, fechando a limitação de "só é possível vincular um anexo já existente via seed".
- `packages/integrations`: `StorageAdapter` (contrato) com `LocalStorageAdapter` (grava em `ATTACHMENT_STORAGE_ROOT`, protegido contra path traversal) e `R2StorageAdapter` (Cloudflare R2, API compatível com S3 via `@aws-sdk/client-s3`), seguindo o mesmo padrão Mock/Http já usado por `MapsAdapter`. `createStorageAdapter(config)` escolhe R2 quando as quatro variáveis `R2_*` estão configuradas, local caso contrário.
- `StorageAdapter.getDownloadUrl(key, expiresInSeconds)`: fecha o ciclo completo (não só upload). No R2, gera uma URL assinada via `@aws-sdk/s3-request-presigner` (assinatura local, sem chamada de rede) para o navegador baixar direto do R2, sem proxy pela API. No local, retorna `undefined` (mantém o streaming local já existente).
- `AttachmentsService.upload()`: gera uma `storageKey` com `work-orders/{id}/{randomUUID()}-{nomeSanitizado}`, delega ao `StorageAdapter`.
- `AttachmentsService.createAccessTicket()` ganhou um terceiro modo, `downloadMode: "redirect"`: quando o arquivo não existe localmente mas o adapter remoto consegue gerar uma URL assinada, o ticket carrega essa URL e o `AttachmentsController` responde com um redirect HTTP real (302) em vez do ticket JSON.
- `POST /work-orders/:id/attachments` (multipart, `FileInterceptor`): valida mimetype (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `application/pdf`) e tamanho (15MB) antes de aceitar, checa permissão de objeto (mesma regra de `work_order:update` das outras mutações), grava o arquivo via `AttachmentsService.upload`, persiste o registro em `attachments` (ou fallback em memória) via `WorkOrdersService.addAttachment`, registra evento de timeline e auditoria.
- UI: seção "Anexos" de `/ordens` ganhou um formulário de upload real (`<input type="file">` + seletor de tipo foto/documento/assinatura), usando `FormData` via `apiFetch`.
- Corrigido um bug real introduzido na Fase 21: `apiFetch` sempre setava `content-type: application/json`, o que quebraria qualquer upload multipart (o browser precisa gerar o `boundary` sozinho). Corrigido em `apps/web` e `apps/mobile-web`.

## Testes

- `packages/integrations`: `LocalStorageAdapter` grava e protege contra path traversal; `getDownloadUrl` retorna `undefined` no adapter local; `createStorageAdapter` escolhe o adapter certo.
- `apps/api/src/modules/attachments/attachments.service.test.ts`: `upload()` grava localmente e sanitiza nomes de arquivo perigosos (`../../etc/passwd` vira só `passwd`); `createAccessTicket()` com credenciais R2 fake (sem rede — `getSignedUrl` assina localmente) confirma `downloadMode: "redirect"` e uma URL válida.
- `apps/api/src/modules/work-orders/work-orders.service.test.ts`: `addAttachment()` no modo demo cria o anexo e ele fica disponível para `addSignature()` vincular em seguida (fluxo ponta a ponta do modo demo).
- `pnpm verify`: lint + typecheck de 13 pacotes + **102 testes**, todos passando.
- `pnpm --filter @fieldops/api build` e `pnpm --filter @fieldops/web build`: builds de produção com sucesso.
- **Não houve verificação visual em navegador** (sem ferramenta de browser disponível) nem teste manual de upload contra um bucket R2 real (sem credenciais configuradas neste ambiente, por decisão do usuário de deixar isso para o final).

## Decisões

- Limite de 15MB e lista de mimetypes permitidos ficaram hardcoded como constantes exportadas (`MAX_ATTACHMENT_BYTES`, `ALLOWED_ATTACHMENT_MIME_TYPES`) em vez de configuráveis por env — é uma regra de produto, não uma credencial de ambiente.
- `getDownloadUrl` foi desenhado como parte do contrato `StorageAdapter` (não um serviço à parte) para manter a simetria com `upload`: quem sabe gravar sabe também gerar o link de leitura do mesmo objeto.
- A "assinatura" (campo `kind: "signature"`) hoje é só um dos tipos de arquivo aceitos no upload genérico — continua sendo upload de uma imagem já pronta (ex.: foto de um papel assinado), não uma captura ao vivo via canvas de desenho. Ver Limitações.

## Limitações

- Não há captura de assinatura via canvas (desenho ao vivo na tela); "assinatura" no upload é só uma categoria de arquivo enviado, igual a foto/documento.
- O mobile-web (fluxo do técnico) ainda não tem UI de upload de anexo — só a página desktop (`/ordens`) ganhou o formulário nesta fase.
- Sem barra de progresso de upload (arquivos grandes ficam sem feedback visual além do estado "Enviando...").
- Sem teste manual contra um bucket R2 real — mesma disciplina já aceita no projeto para `HttpMapsAdapter` (Fase 12): validar quando as credenciais forem configuradas em ambiente com rede.
