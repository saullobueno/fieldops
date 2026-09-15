# Relatório da Fase 11

## Implementado

- Página `/ordens` agora exibe a trilha de auditoria da ordem selecionada.
- Consulta de auditoria separada via TanStack Query usando `GET /work-orders/:id/audit`.
- Invalidação da auditoria após mudanças de status, checklist e notas.
- Formatação compacta de ação, ator, horário e delta auditado.

## Testes

- Typecheck focado de `@fieldops/web` executado com sucesso.
- Typecheck focado de `@fieldops/types` executado com sucesso.

## Decisões

- A auditoria fica em consulta independente do detalhe principal para evitar payload pesado em navegação operacional.
- A tela mostra o delta bruto em JSON nesta fase para preservar fidelidade do evento auditado.

## Limitações

- Ainda não há filtros na UI por ação, ator ou período.
- O delta auditado ainda não tem renderização semântica por tipo de ação.
