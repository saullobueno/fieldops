# Relatório da Fase 24

## Implementado

- CRUD de escrita para **Clientes** (criar + editar), primeira fatia do módulo administrativo — as demais entidades (locais, contatos, contratos, ativos) continuam só leitura e ficam para a próxima fatia (ver Limitações).
- Novas permissões `customer:manage` e `asset:manage` em `packages/auth` (o catálogo de permissões não tinha nenhuma permissão de escrita para essas entidades — só `customer:read`/`asset:read`). O papel "Administrador" do seed e do fallback demo ganhou as duas.
- `POST /customers` e `PATCH /customers/:id`: validação Zod (nome obrigatório, referência externa e notas opcionais), autorização por `customer:manage`, persistência real no Postgres com fallback determinístico em memória (mesmo padrão de todos os outros serviços do projeto).
- UI em `/clientes`: botão "Novo cliente" no header abre um formulário inline na lista; o painel de detalhe ganhou um botão "Editar" que troca a visualização por um formulário pré-preenchido. Ambos usam a mesma `CustomerForm` reaproveitada.

## Testes

- `apps/api/src/modules/customers/customers.service.test.ts`: cria cliente e confirma que aparece na listagem; atualiza cliente sem afetar os demais registros do modo demo; erro ao atualizar cliente inexistente.
- `pnpm verify`: lint + typecheck de 13 pacotes + **105 testes**, todos passando.
- `pnpm --filter @fieldops/api build` e `pnpm --filter @fieldops/web build`: builds de produção com sucesso.
- Não houve verificação visual em navegador (sem ferramenta de browser disponível nesta sessão).

## Decisões

- Uma única permissão `customer:manage` cobre criar e editar (não `customer:create`/`customer:update` separadas) — é uma decisão de produto (quem pode cadastrar também pode editar), não uma restrição técnica; mantém o catálogo de permissões menor.
- O formulário de cliente foi extraído como componente reaproveitável (`CustomerForm`) para o mesmo componente servir criação (vazio) e edição (pré-preenchido via prop `initial`), evitando duplicar os três campos duas vezes.
- Delete não foi implementado nesta fatia — não havia pedido explícito por exclusão, e remover um cliente com locais/ordens vinculadas abre questões de integridade (cascade vs. bloqueio) que merecem uma decisão própria.

## Limitações

- Locais, contatos, contratos e ativos continuam só leitura — só o cliente "raiz" ganhou escrita nesta fatia. Fechamento natural: reaproveitar o mesmo padrão (`*:manage` permission + service create/update + form component) para essas quatro entidades.
- Sem exclusão (delete) de cliente.
- Sem validação de duplicidade de `externalRef` na UI (o banco tem um índice único por organização; uma colisão hoje cairia no fallback de erro genérico "Falha ao criar/atualizar cliente", não numa mensagem específica).
