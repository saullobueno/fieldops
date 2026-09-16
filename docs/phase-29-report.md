# Relatório da Fase 29

## Implementado

- Nova tabela `ai_recommendations` (organização, conversa, autor, pergunta, título, resumo, fonte, ação sugerida, evidência, `requires_approval`, `approved_at`).
- `CopilotService.buildAndStoreRecommendation` grava a recomendação em `ai_recommendations` (best-effort, junto da conversa/evidência já persistidas em `ai_conversations`/`ai_tool_calls`).
- `CopilotService.approve` passou a resolver a recomendação por `loadRecommendation`: primeiro consulta o `Map` em memória (caminho rápido) e, se ausente, busca em `ai_recommendations` — permitindo aprovar uma recomendação mesmo após um restart da API quando há Postgres configurado.
- Aprovação grava `approved_at` em `ai_recommendations` (`persistApproval`), além da auditoria já existente em `audit_logs`.

## Testes

- `pnpm vitest run apps/api/src/modules/copilot packages/database/src/schema.test.ts`: 5 testes passando (caminho sem Postgres, que é o exercitado pela suíte atual).
- `pnpm verify` completo: lint + typecheck de 13 pacotes + 106 testes, todos passando.

## Decisões

- O `Map` em memória não foi removido: continua como cache de leitura imediata (evita ler o próprio insert assíncrono logo em seguida) e como único caminho em modo demo (sem Postgres). O banco é a fonte de verdade quando disponível.
- Persistência da recomendação e da aprovação seguem o padrão *best-effort* já usado em `persistConversation`/`recordApprovalAudit`: falha ao gravar não interrompe o fluxo do usuário.

## Limitações

- Sem teste automatizado exercitando o caminho com Postgres real (mesma disciplina do projeto de não depender de rede/banco real em testes) — validado por leitura de código e pelos testes de schema/migração.
