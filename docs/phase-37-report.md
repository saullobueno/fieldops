# Relatório da Fase 37

## Implementado

- `/ordens` ganhou uma barra de progresso durante o upload de anexos. Como `fetch`/`apiFetch` não expõem progresso de upload, `uploadWorkOrderAttachment` foi reescrita para usar `XMLHttpRequest` diretamente (`xhr.upload.onprogress`), replicando manualmente o cabeçalho `authorization` que `apiFetch` normalmente injeta (via `getStoredSession`).
- A barra (`role="progressbar"`, com `aria-valuenow`/`aria-valuemin`/`aria-valuemax`) aparece só enquanto o upload está em andamento (`attachmentMutation.isPending`).

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 112 testes, todos passando (mudança é só no cliente HTTP do upload; a API não mudou).
- Verificação manual em navegador (Playwright ad-hoc): login, `/ordens`, selecionar arquivo, enviar anexo — confirmado que o elemento `progressbar` aparece durante o envio, nenhum erro é exibido e o anexo aparece na lista após concluir.

## Decisões

- Escopo reduzido ao upload **desktop** (`apps/web`). A segunda metade do item 33 do backlog — o técnico (`apps/mobile-web`) enfileirar arquivos binários offline no IndexedDB — é uma mudança bem maior na arquitetura de sincronização (`packages/sync`, `offline-db.ts`) e fica para uma fatia própria se houver demanda; hoje o mobile-web não faz upload de anexos, então não há progresso a mostrar ali.
- Não foi criado um componente de progresso reutilizável em `packages/ui` para uma única barra usada em um único lugar — inline mesmo, consistente com "não abstrair antes de precisar".

## Limitações

- Upload offline de anexos no mobile-web continua em aberto (ver item correspondente no backlog).
