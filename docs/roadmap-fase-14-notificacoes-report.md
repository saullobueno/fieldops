# Relatório — Roadmap Fase 14: Notificações

## Implementado

- Novo módulo `notifications` na API com listagem, filtros por status/tipo, marcação como lida/arquivada e preferências por tipo/canal.
- Fallback demo determinístico para execução sem Postgres.
- Tipos compartilhados de notificações e preferências em `@fieldops/types`.
- Página `/notificacoes` no web com central de eventos, contagem de não lidas, filtros, ações de status e toggles de preferências.
- Permissões `notification:read` e `notification:update` adicionadas ao catálogo e ao seed demo.

## Testes

- Testes unitários de `NotificationsService`.
- Typecheck focado de API, web e database executado com sucesso.

## Decisões

- Preferências começam em contrato simples de API e armazenamento em memória até existir uma tabela dedicada.
- A central usa o canal `in_app` como primeiro adaptador realista, deixando e-mail/SMS modelados como preferência.

## Limitações

- Preferências ainda não são persistidas no banco.
- Nenhum provedor externo de e-mail/SMS foi conectado.
