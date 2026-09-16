# Fase 45 — Calendário externo no despacho

## Entregue

- Novo `CalendarModule`/`CalendarService` na API.
- `CalendarService` consome um `CalendarAdapter` opcional; `CALENDAR_PROVIDER=mock` habilita o `MockCalendarAdapter`.
- `DispatchService` passou a considerar bloqueios externos de calendário em dois fluxos:
  - cálculo de candidatos (`hasConflict`);
  - criação de atribuição, bloqueando o despacho se houver conflito externo.
- Sem provider configurado, `CalendarService` retorna lista vazia e o comportamento demo permanece igual.

## Verificação

- `pnpm vitest run apps/api/src/modules/calendar apps/api/src/modules/dispatch`: 2 arquivos, 6 testes passando.
- `pnpm --filter @fieldops/api typecheck`: passando.

## Limitações

- Ainda não há integração real com Google Calendar/Outlook; a fronteira está conectada ao fluxo de negócio e pronta para receber um adapter real no futuro.
