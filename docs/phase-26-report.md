# Relatório da Fase 26

## Implementado

- `apps/mobile-web` ganhou detalhe expandível por ordem no fluxo do técnico.
- Detalhes completos de ordem (`WorkOrderDetail`) agora são cacheados em IndexedDB (`work-order-details`, versão 2 do banco local), permitindo abrir checklist offline depois de carregado uma vez.
- Checklist no mobile:
  - renderiza campos de texto, número, checkbox e pass/fail;
  - salva via fila offline usando a operação `checklist_update` já existente;
  - aplica atualização otimista no detalhe cacheado.
- Upload mobile:
  - formulário para enviar foto ou documento em `POST /work-orders/:id/attachments`;
  - reaproveita o `apiFetch` multipart já corrigido na Fase 23.
- Assinatura mobile:
  - canvas de desenho com Pointer Events;
  - gera PNG local (`File`) e envia como anexo `kind=signature`;
  - vincula o anexo retornado via `POST /work-orders/:id/signature`.
- O teste Playwright do técnico passou a cobrir checklist offline em vez de só avanço de status.

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 106 testes, todos passando.
- `pnpm e2e`: 2 testes Playwright passando:
  - drag-and-drop do despacho;
  - técnico abre detalhe, preenche checklist offline, enfileira operação e sincroniza ao voltar online.

## Decisões

- Upload e assinatura ficaram online-first nesta fase. A fila offline atual sincroniza operações JSON; arquivos binários exigiriam persistir blobs no IndexedDB e estender o contrato do sync.
- O detalhe da ordem é carregado sob demanda para evitar inflar a listagem inicial do técnico.
- A assinatura usa canvas nativo, sem dependência externa.

## Limitações

- Upload de anexos e assinatura ainda não funcionam offline.
- Não há barra de progresso de upload no mobile.
- O checklist mobile cobre os tipos usados no demo; tipos avançados como select/options podem ser refinados quando houver template com essas opções no fluxo mobile.
