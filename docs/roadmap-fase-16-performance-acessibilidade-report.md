# Relatório — Roadmap Fase 16: Performance/acessibilidade

## Implementado

- Listas de ordens e clientes ganharam ação "Carregar mais" usando `limit` do contrato existente.
- Despacho ganhou seletor de data no header.
- Drag de despacho passou a exibir preview de candidato com pontuação, conflito e deslocamento estimado.
- Relatórios ganharam exportação CSV dos dados carregados.
- Filtros novos receberam `aria-label`.
- Preferências de notificações usam botão com `aria-pressed`.

## Testes

- Typecheck focado de web executado com sucesso após as mudanças iniciais.

## Decisões

- A paginação incremental aumenta o limite visível no cliente sem mudar o contrato da API.
- Virtualização ficou fora desta fatia porque as listas atuais ainda são pequenas e paginadas.

## Limitações

- Ainda falta Playwright para validação real de navegação, offline e regressões visuais.
- Não houve auditoria automatizada completa de acessibilidade.
