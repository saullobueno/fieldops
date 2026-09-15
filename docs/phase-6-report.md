# Relatório da Fase 6

## Implementado

- Serviço de ordens com caminho persistente em PostgreSQL para listagem, detalhe e mudança de status.
- Fallback demo em memória preservado para testes unitários e execução local sem banco disponível.
- Mudança de status transacional com bloqueio da ordem, atualização do registro, evento de timeline e `audit_logs`.
- Anexos no detalhe da ordem com URL assinada efêmera e expiração explícita.
- Seed demo ampliado com anexo, evento operacional e auditoria inicial.

## Testes

- Testes unitários atualizados para fluxo assíncrono.
- Cobertura adicionada para emissão de URL assinada no modo demo.
- `pnpm typecheck` executado com sucesso.
- `pnpm test` executado com sucesso.

## Decisões

- O serviço tenta PostgreSQL quando o pool está disponível e cai para dados determinísticos se a dependência estiver indisponível.
- A auditoria de status foi mantida no mesmo comando transacional da mutação principal.
- O contrato de anexo ganhou campos opcionais de URL assinada para não quebrar consumidores existentes.

## Limitações

- Checklist e notas ainda retornam vazios no caminho persistente até a próxima fatia de formulários/comentários.
- A URL assinada ainda representa um contrato de download; o handler de streaming/validação de assinatura entra na fase seguinte.
