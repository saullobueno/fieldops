# Relatório da Fase 17

## Implementado

- Endpoint de anexos passa a transmitir arquivo local quando o `storage_key` existe em `ATTACHMENT_STORAGE_ROOT`.
- Resolução de caminho protege contra path traversal.
- Configuração `ATTACHMENT_STORAGE_ROOT` adicionada.
- Arquivo demo local criado para `WO-1001`.
- Anexo demo em memória passou a apontar para a chave persistente usada pelo seed.

## Testes

- Teste unitário para modo `storage-proxy` quando arquivo local existe.
- Typecheck focado de API e config executado com sucesso.

## Decisões

- Storage local é o primeiro backend de arquivos; S3/GCS pode entrar depois usando o mesmo contrato de ticket.
- Quando o arquivo não existe localmente, a API mantém o ticket JSON como fallback.

## Limitações

- Não há suporte a range requests.
- O provider cloud ainda não foi implementado.
