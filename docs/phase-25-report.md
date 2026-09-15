# Relatório da Fase 25

## Implementado

- CRUD administrativo restante em `/clientes`: locais, contatos, contratos e ativos agora podem ser criados e editados por formulários inline no painel de detalhe do cliente.
- API de clientes ganhou rotas aninhadas:
  - `POST /customers/:customerId/sites` e `PATCH /customers/:customerId/sites/:siteId`
  - `POST /customers/:customerId/contacts` e `PATCH /customers/:customerId/contacts/:contactId`
  - `POST /customers/:customerId/contracts` e `PATCH /customers/:customerId/contracts/:contractId`
  - `POST /customers/:customerId/assets` e `PATCH /customers/:customerId/assets/:assetId`
- `CustomersService` ganhou persistência real em Postgres e fallback demo em memória para as quatro entidades, mantendo o padrão já usado no CRUD de clientes.
- Tipos de `CustomerSite` e `CustomerAssetSummary` foram enriquecidos para a UI conseguir editar sem perder campos como CEP, país, coordenadas, instruções de acesso e fim da garantia.
- Estabilização de QA/E2E:
  - `tsconfig.json` agora inclui `tests/**/*.ts`, corrigindo o lint tipado dos testes Playwright.
  - `useRequireAuth` em web/mobile relê a sessão antes de redirecionar, evitando redirect falso para `/login` durante hidratação.
  - `storeSession`/`clearSession` notificam a própria aba, não apenas outras abas via `storage`.
  - O helper IndexedDB do mobile espera `transaction.oncomplete`, evitando leituras antes da escrita da fila terminar.
  - A UI mobile atualiza o cache da fila diretamente ao enfileirar/remover comandos, importante quando o navegador está offline e o TanStack Query não refaz fetch.

## Testes

- `apps/api/src/modules/customers/customers.service.test.ts`: novo teste cobre criar e atualizar local, contato, contrato e ativo no modo demo.
- `pnpm verify`: lint + typecheck de 13 pacotes + 106 testes, todos passando.
- `pnpm e2e`: 2 testes Playwright passando:
  - drag-and-drop do despacho;
  - técnico offline enfileirando comando e sincronizando ao voltar online.

## Decisões

- Locais, contatos e contratos usam `customer:manage`; ativos usam `asset:manage`, reaproveitando o catálogo de permissões já criado na Fase 24.
- Formulários continuam inline no painel de cliente em vez de criar páginas administrativas separadas, porque a tela atual já concentra cliente, locais, contratos, contatos e ativos.
- Não foi implementado delete nesta fase. Exclusão ainda precisa de decisão de produto sobre vínculo com ordens, anexos e histórico.

## Limitações

- Sem exclusão para locais, contatos, contratos e ativos.
- Sem validações de unicidade amigáveis na UI para serial de ativo ou referência externa.
- A tela de clientes ficou mais completa, mas ainda não há filtros por local, território ou contrato ativo.
