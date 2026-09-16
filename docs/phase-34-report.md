# Relatório da Fase 34

## Implementado

- `attachments` ganhou a coluna `revoked_at` (timestamp nulo); `audit_action` ganhou o valor `revoke`.
- `AttachmentsService.createAccessTicket` passou a checar `revoked_at` do anexo (via `findAttachment`) e responder `410 Gone` ("Link revogado.") antes de gerar o ticket de acesso, mesmo com assinatura/expiração ainda válidas.
- Novo `AttachmentsService.revoke({ attachmentId, organizationId, actorUserId })`: marca `revoked_at = now()` (só se ainda não revogado) e grava uma entrada em `audit_logs` (`action: 'revoke'`).
- Novo endpoint `POST /work-orders/:id/attachments/:attachmentId/revoke` (permissão `work_order:update`, mesmo escopo de objeto das demais mutações de ordem), que chama `AttachmentsService.revoke` e retorna a ordem atualizada.
- `WorkOrderAttachment` ganhou `revokedAt: string | null`; quando revogado, `toSignedAttachment` omite `signedUrl`/`signedUrlExpiresAt` (a UI não oferece mais um link morto).
- `/ordens`: cada anexo não revogado ganhou um botão "Revogar"; anexos revogados mostram "Revogado em HH:mm" no lugar do prazo de expiração.

## Testes

- `apps/api/src/modules/attachments/attachments.service.test.ts`: novo teste cobrindo `revoke()` sem Postgres configurado (rejeita com mensagem clara).
- `pnpm verify`: lint + typecheck de 13 pacotes + 112 testes, todos passando.

## Decisões

- Revogação só funciona com Postgres configurado — em modo demo, `revoke()` rejeita explicitamente em vez de fingir sucesso. Diferente de outras fatias (notas, checklist) onde o modo demo tem paridade total, aqui o anexo demo é um array de literais fixos sem um "banco" para marcar `revoked_at`; forçar paridade exigiria acoplar `AttachmentsService` ao array demo de `WorkOrdersService` só para esse caso de borda, o que não parecia valer a complexidade.
- Não foi adicionado teste automatizado cobrindo o caminho real com Postgres (update + nova checagem em `createAccessTicket`) — mesma disciplina já registrada no backlog de não depender de banco real em testes; a query em si segue o mesmo padrão (`update ... returning`) já usado e testado indiretamente em outros serviços.

## Limitações

- Sem UI para listar/objetivo o histórico de revogações (fica só no `audit_logs`, consultável via `/work-orders/:id/audit`).
