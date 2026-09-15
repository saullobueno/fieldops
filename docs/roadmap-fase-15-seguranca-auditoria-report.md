# Relatório — Roadmap Fase 15: Segurança/auditoria

## Implementado

- Auditoria de ordens agora aceita filtros por ação, ator e período.
- Mudança de status passa a registrar `actor_user_id` no audit log persistente.
- API aceita bearer token assinado por HMAC para sessão do ator, mantendo headers como fallback local.
- `FIELDOPS_SESSION_SECRET` adicionado à validação de ambiente.
- Threat model documentado em `docs/security-threat-model.md`.

## Testes

- Testes unitários de auth, auditoria, notificações e config executados com sucesso.
- Typecheck focado de API e config executado com sucesso.

## Decisões

- O token assinado representa o ator já resolvido, sem ainda introduzir login/senha.
- Filtros de auditoria foram adicionados ao fluxo existente de ordens para minimizar superfície nova.

## Limitações

- Ainda falta login real com senha/SSO e sessão persistente.
- Revogação antecipada de links assinados segue aberta.
