# Relatório da Fase 13

## Implementado

- Seção de auditoria em `/ordens` ganhou filtros por ação e limite.
- Consulta da UI passa `action` e `limit` para `GET /work-orders/:id/audit`.
- Cache de auditoria inclui os filtros na `queryKey`.

## Testes

- Typecheck focado de `@fieldops/web` executado com sucesso.

## Decisões

- Os filtros ficam locais ao painel de detalhe para manter a navegação da lista simples.
- A invalidação por prefixo preserva atualização da auditoria após mutações, independentemente do filtro ativo.

## Limitações

- Ainda não há filtro por ator ou intervalo de datas.
- A renderização do delta continua textual/JSON.
