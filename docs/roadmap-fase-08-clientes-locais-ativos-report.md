# Relatório — Roadmap Fase 8: Clientes/Locais/Ativos

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre para evitar ambiguidade.

## Implementado

- Módulo `customers` na API: `GET /customers` (lista pesquisável por nome, paginada) e `GET /customers/:id` (detalhe com locais, contatos, contratos e ativos), protegidos por `customer:read`.
- Módulo `assets` na API: `GET /assets/:id` (detalhe do ativo com timeline de manutenção derivada de `work_order_events`/`work_orders` e documentos de `attachments` com URL assinada), protegido por `asset:read`.
- Ambos os serviços seguem o padrão já estabelecido: consulta PostgreSQL quando o pool está disponível, com fallback determinístico em memória.
- Novos contratos em `@fieldops/types`: `CustomerSummary`, `CustomerListResponse`, `CustomerDetail`, `CustomerSite`, `CustomerContact`, `CustomerContract`, `CustomerAssetSummary`, `AssetDetail`, `AssetMaintenanceEvent`, `AssetDocument`.
- Componente `AppShell` extraído para `@fieldops/ui`, eliminando a duplicação da navegação lateral que existia entre `page.tsx` e `ordens/page.tsx`. As três páginas (`/`, `/ordens`, `/clientes`) agora compartilham o mesmo shell.
- Página `/clientes`: lista pesquisável de clientes, detalhe com locais/contatos/contratos/ativos, e painel de manutenção do ativo selecionado (linha do tempo + documentos com link assinado).

## Testes

- Testes unitários de `CustomersService` (listagem filtrada, detalhe com relacionamentos, erro para cliente inexistente).
- Testes unitários de `AssetsService` (detalhe com timeline e documentos, erro para ativo inexistente).
- `pnpm typecheck` executado com sucesso nos 13 pacotes do monorepo.
- `pnpm test` executado com sucesso (31 testes, 14 arquivos).
- `eslint` executado com sucesso nos arquivos novos/alterados desta fatia (o `pnpm lint` completo falha por um problema pré-existente e não relacionado: dependência `next/babel` ausente para os arquivos `.mjs`/`.mts` da raiz do repositório).

## Decisões

- Autorização de leitura para clientes/ativos segue o padrão de catálogo (escopo por organização via `WHERE organization_id = $1`), e não o escopo estrito de objeto (equipe/território) usado em ordens de serviço — coerente com o catálogo de permissões atual, que só define `customer:read`/`asset:read` sem nuance de equipe/território para essas entidades.
- Timeline de manutenção do ativo é derivada dos eventos já existentes de `work_order_events` filtrados por `asset_id`, evitando nova tabela nesta fatia.
- Documentos do ativo reutilizam o mesmo mecanismo de URL assinada HMAC do módulo de anexos.

## Limitações

- Não há CRUD de escrita para clientes, locais, contatos, contratos ou ativos — apenas leitura/pesquisa, conforme o catálogo de permissões atual.
- A busca de clientes cobre apenas o nome; não há filtro por local, território ou contrato ativo.
- Sem paginação de fato na UI (a lista carrega os primeiros 20 registros sem "carregar mais").

## Próxima fase

Fase 6 do roadmap mestre (Despacho): grade de agenda, faixas de técnicos, atribuição com drag-and-drop, detecção de conflitos, mapa e estimativas de rota/SLA — ainda não iniciada.
