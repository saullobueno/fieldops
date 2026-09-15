# Relatório da Fase 7

## Implementado

- Módulo de anexos com endpoint `GET /attachments/:storageKey`.
- Validação de URLs assinadas com HMAC, expiração e comparação segura.
- Serviço de ordens passou a reutilizar o assinador do módulo de anexos.
- Configuração `ATTACHMENT_URL_SECRET` adicionada ao ambiente validado.

## Testes

- Teste unitário para URL assinada vigente.
- Teste unitário para bloqueio de assinatura inválida.

## Decisões

- O endpoint retorna um ticket de acesso controlado enquanto o storage real ainda não existe.
- A validação de assinatura é pública por desenho, porque a autorização está embutida no link efêmero.

## Limitações

- Streaming do arquivo físico ou objeto S3/GCS ainda não foi conectado.
- Revogação antecipada de links assinados fica para a integração com storage e auditoria de download.
