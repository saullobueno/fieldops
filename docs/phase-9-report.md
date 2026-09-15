# Relatório da Fase 9

## Implementado

- Endpoint `PATCH /work-orders/:id/checklist` para atualizar respostas de checklist.
- Endpoint `POST /work-orders/:id/notes` para registrar notas operacionais.
- Mutação de checklist persistida em `checklist_responses` com evento e auditoria.
- Notas persistidas como eventos `note_added`, reaproveitando timeline e auditoria.
- Página `/ordens` agora permite marcar checklist e adicionar notas.

## Testes

- Testes unitários para atualização de checklist no modo demo.
- Testes unitários para inclusão de nota operacional no modo demo.
- Typecheck focado de API, tipos e web executado com sucesso.

## Decisões

- Notas foram modeladas como eventos operacionais nesta fase para evitar nova tabela antes de definir comentários, menções e anexos de nota.
- O contrato de checklist ganhou `answerKey` opcional para preservar compatibilidade e permitir respostas por chave estável.

## Limitações

- A UI ainda não faz atualização otimista do checklist.
- Edição e remoção de notas ficam para fases posteriores.
