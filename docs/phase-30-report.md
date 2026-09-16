# Relatório da Fase 30

## Implementado

- `GET /reports/filters` (permissão `report:read`) retorna `teams`/`territories` reais da organização (`teams`/`territories` do Postgres, com fallback demo espelhando os dois times/territórios do seed). `/relatorios` passou a popular os seletores de equipe/território a partir desse endpoint, em vez das listas fixas com os dois itens do seed demo.
- `GET /customers/territories` (permissão `customer:read`) lista os territórios da organização. `CustomerListFilter` ganhou `territoryId`, aplicado via `exists (select ... from sites ...)` no caminho Postgres e via `sites.some(...)` no fallback em memória.
- `/clientes` ganhou um seletor "Filtrar clientes por território" ao lado da busca por nome.
- Novo tipo compartilhado `NamedOption` (`{id, name}`) em `@fieldops/types`, reaproveitado pelos três endpoints novos.

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 106 testes, todos passando.

## Decisões

- Não foi criado um módulo "admin" genérico de equipes/territórios: cada endpoint de listagem foi colocado no módulo que já teria a permissão certa para consumi-lo (`ReportsModule` com `report:read`, `CustomersModule` com `customer:read`), evitando uma abstração de RBAC que o `AuthGuard` atual não suporta (permissões declaradas em `@RequirePermissions` são todas obrigatórias, sem OR entre permissões).
- Filtro de clientes por território usa `exists` sobre `sites` em vez de `join`, para não alterar a contagem de `sites_count`/`open_work_orders_count` já calculada com `left join` + `count(distinct ...)`.

## Limitações

- Item 7 do backlog (busca de clientes) segue parcialmente aberto: ainda não há filtro por contrato ativo, só por nome e território.
