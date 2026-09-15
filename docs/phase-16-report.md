# Relatório da Fase 16

## Implementado

- Anexos na página `/ordens` agora exibem ação para abrir o ticket assinado.
- UI mostra nome, tipo e expiração do link assinado.
- Link usa o endpoint da API para validar assinatura e registrar acesso quando persistido.

## Testes

- Typecheck focado de `@fieldops/web` executado com sucesso.

## Decisões

- A tela abre o ticket em nova aba para manter o fluxo operacional intacto.
- Nenhuma query extra foi adicionada; a URL assinada já vem no detalhe da ordem.

## Limitações

- O endpoint ainda retorna ticket JSON em vez de transmitir o binário.
- Preview inline de imagens/documentos fica para uma fase posterior.
