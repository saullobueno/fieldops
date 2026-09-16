# Relatório da Fase 31

## Implementado

**Validação de formato do checklist (item 18 do backlog)**
- `validateChecklistAnswers` (`@fieldops/domain`) passou a checar `min`/`max` (campos `number`) e `pattern`/regex (campos `text`) além da presença obrigatória, retornando `{key, reason: "required" | "format"}[]` em vez de só as chaves.
- `WorkOrdersService` (caminho Postgres e caminho demo) passa `type`/`validation` de cada campo para a validação e separa as duas mensagens de erro ("obrigatórios sem resposta" vs. "formato inválido").
- `WorkOrderChecklistItem` ganhou `validation?: Record<string, unknown>`, exposto pela API para o front-end.

**Editar/remover notas (item 11, parte 1)**
- `PATCH /work-orders/:id/notes/:noteId` e `DELETE /work-orders/:id/notes/:noteId`, seguindo o mesmo padrão de permissão/escopo (`work_order:update` + `authorizeObjectAccess`) das demais rotas de ordem.
- `/ordens` ganhou edição inline (textarea) e remoção de nota na seção "Notas".

**Atualização otimista do checklist (item 11, parte 2)**
- `checklistMutation` em `/ordens` usa `onMutate`/`onError` do TanStack Query para atualizar `value`/`completed` no cache antes da resposta do servidor, revertendo em caso de erro.

**UI de autoria de templates de checklist (item 16)**
- Nova página `/checklists` (nav "Checklists" em `AppShell`): lista templates, mostra os campos da versão mais recente e permite editar (adicionar/remover linhas, com min/max para número e regex para texto) publicando uma nova versão via `POST /checklist-templates/:id/versions` (endpoint que já existia, só sem tela).

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 109 testes (3 novos: 2 de validação de formato em `@fieldops/domain`, 1 de rejeição por formato inválido em `WorkOrdersService`).
- Verificação manual em navegador (Playwright ad-hoc, API e web em modo demo): login, `/checklists` → selecionar template → "Editar campos" → ajustar mínimo/máximo do campo numérico → "Publicar nova versão" → confirmado versão 2 com `{"min":0,"max":250}` refletido na tela.

## Decisões

- `validateChecklistAnswers` mudou de retornar `string[]` para `{key, reason}[]`: quebra de contrato interno (só usado dentro do monorepo), mas necessário para diferenciar "faltou preencher" de "formato inválido" nas mensagens de erro.
- A UI de autoria não expõe exclusão de templates nem edição de metadados (nome/serviceTypeId) — só o que o backend já suportava (nova versão de campos).

## Limitações

- Sem exclusão/reordenação de templates na UI (API também não suporta).
- Validação de formato cobre só `min`/`max`/`pattern`; não há UI para outras regras (ex.: opções de `select`).
