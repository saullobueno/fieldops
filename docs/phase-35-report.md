# Relatório da Fase 35

## Implementado

- `sites`, `contacts`, `contracts` e `assets` ganharam `deleted_at` (timestamp nulo).
- `CustomersService` ganhou `deleteSite`/`deleteContact`/`deleteContract`/`deleteAsset`: no Postgres, fazem soft-delete (`update ... set deleted_at = now() ... and deleted_at is null`, retornando a ordem/cliente atualizado); no modo demo, removem o item do array em memória (sem conceito de soft-delete, consistente com o resto do modo demo).
- Todas as queries de leitura (`getFromDatabase`, `listFromDatabase`) e de escrita (`update*InDatabase`, `createAssetInDatabase`) passaram a excluir registros com `deleted_at` preenchido, incluindo os `exists`/`join` usados pelos filtros de território e contrato ativo.
- Novos endpoints `DELETE /customers/:customerId/sites/:siteId`, `.../contacts/:contactId`, `.../contracts/:contractId` (permissão `customer:manage`) e `.../assets/:assetId` (permissão `asset:manage`, mesma da criação/edição de ativos).
- `/clientes` ganhou botão "Remover" (com confirmação via `window.confirm`) em cada local, contato, contrato e ativo listado.

## Testes

- `apps/api/src/modules/customers/customers.service.test.ts`: o teste de CRUD demo existente foi estendido para também remover cada entidade criada e confirmar que some da listagem, além de verificar que remover de novo o mesmo local lança "não encontrado".
- `pnpm verify`: lint + typecheck de 13 pacotes + 112 testes, todos passando.

## Decisões

- Optou-se por soft-delete (não hard-delete) em `sites`/`assets` porque `work_orders.site_id` é `NOT NULL` com `onDelete: "restrict"` — um hard-delete de local com ordens vinculadas seria bloqueado pelo Postgres de qualquer forma, e apagar de vez perderia rastreabilidade de ordens já concluídas. Por consistência, `contacts`/`contracts` (que não têm nenhuma FK apontando para eles) seguiram o mesmo padrão em vez de hard-delete, mantendo a UX e a auditoria uniformes entre as quatro entidades.
- Não foi implementada exclusão de clientes (`customers`) nesta fatia — o item do backlog cobre "locais, contatos, contratos e ativos"; remover o cliente-raiz é uma decisão maior (o que fazer com ordens de serviço históricas do cliente) que fica para uma fase própria se houver demanda.
- Modo demo não tem paridade de soft-delete (a remoção é definitiva no array em memória) — aceitável porque o modo demo já reseta a cada restart da API e não tem conceito de auditoria/histórico como o Postgres.

## Limitações

- Sem UI para listar/restaurar itens soft-deletados (fica só como um registro em `deleted_at`, consultável direto no banco).
- Exclusão de clientes em si segue em aberto (ver item correspondente no backlog, se aplicável).
