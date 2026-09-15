# Relatório da Fase 12

## Implementado

- Endpoint `GET /work-orders/:id/audit` agora aceita filtros `action` e `limit`.
- Consulta SQL de auditoria monta filtros parametrizados e limite explícito.
- Fallback demo aplica os mesmos filtros no modo em memória.

## Testes

- Teste unitário para limite de trilha de auditoria no modo demo.
- Typecheck focado de `@fieldops/api` executado com sucesso.

## Decisões

- O filtro de ação é textual nesta fase para refletir diretamente o enum de auditoria já existente.
- O limite máximo do endpoint fica em 100 itens para evitar payloads longos na tela operacional.

## Limitações

- Filtro por ator e período ainda não foi exposto.
- A UI ainda não usa os filtros desta fase.
