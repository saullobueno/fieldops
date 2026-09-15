# Relatório — Roadmap Fase 9: Formulários/Inspeções

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre, seguindo o padrão de `docs/roadmap-fase-06-despacho-report.md`, `docs/roadmap-fase-07-tecnico-offline-report.md` e `docs/roadmap-fase-08-clientes-locais-ativos-report.md`.

## Implementado

- `packages/domain`: `checklistFieldTypes`/`ChecklistFieldType` (union dos 7 tipos de campo já previstos no schema desde a Fase 1) e `validateChecklistAnswers` — função pura que retorna as chaves obrigatórias sem resposta, testada isoladamente.
- Checklist de ordens de serviço deixou de ser uma lista de booleanos e passou a carregar o schema real do campo: `type`, `isRequired`, `value` tipado e `options` (extraídas de `form_fields.validation.options`). O `WorkOrderDetail` agora também expõe `signatures`.
- `PATCH /work-orders/:id/checklist` valida campos obrigatórios antes de gravar (banco e modo demo) e retorna 400 com a lista exata de chaves faltantes em vez de aceitar qualquer payload parcial.
- `POST /work-orders/:id/signature`: captura uma assinatura vinculando um anexo já existente da própria ordem (`signer_name` + `attachment_id`, conforme a tabela `signatures` já definida desde a Fase 1); rejeita anexos que não pertencem à ordem.
- Módulo `checklist-templates`: `GET /checklist-templates` (lista com a versão mais recente), `GET /checklist-templates/:id` (detalhe com todas as versões e campos) e `POST /checklist-templates/:id/versions` (publica uma nova versão incrementando o número, sem alterar versões já usadas por ordens existentes) — a capacidade de "versionar templates" pedida pela fase, antes só existente no schema/seed.
- `apps/web` (`/ordens`): o checklist agora renderiza um controle por tipo de campo (checkbox para `pass_fail`/`checkbox`, input numérico, texto, `select` com opções, e um seletor de anexo existente para `photo`/`signature`), mostra `*` em campos obrigatórios e exibe a mensagem de erro exata do servidor quando a validação falha. Nova seção "Assinatura" permite registrar o nome de quem assina vinculado a um anexo da ordem.

## Testes

- Testes unitários novos em `packages/domain`: `validateChecklistAnswers` (campo obrigatório faltando, zero/falso como resposta válida, todos preenchidos).
- Testes unitários novos em `WorkOrdersService`: rejeição de checklist com campo obrigatório faltando, assinatura com anexo válido, rejeição de assinatura com anexo que não pertence à ordem.
- Testes unitários novos em `ChecklistTemplatesService`: listagem/detalhe demo, publicação de nova versão incrementando o número, rejeição sem campos e para template inexistente.
- `pnpm typecheck` (13 pacotes) e `pnpm test` (54 testes, 17 arquivos) executados com sucesso.
- `eslint` limpo nos arquivos novos/alterados (um erro real de assertion desnecessária foi corrigido durante a verificação).
- Verificação manual ponta a ponta via `curl` contra a API rodando de verdade: checklist enriquecido retornando `type`/`isRequired`/`value`; `PATCH /checklist` rejeitando com 400 e a mensagem exata quando faltam `pressao_entrada`/`leitura_eletrica`, e aceitando com 200 quando completo; `POST /signature` aceitando um anexo válido (201) e rejeitando um anexo alheio à ordem (400); `POST /checklist-templates/:id/versions` publicando a versão 2 corretamente. Página `/ordens` renderiza sem erros de servidor/runtime.

## Decisões

- Assinatura e evidência fotográfica reaproveitam o mecanismo de anexos já existente (vincular um `attachmentId` já presente na ordem) em vez de construir infraestrutura de upload nova — não há endpoint de upload de arquivos no projeto ainda; construir um estava fora do escopo desta fatia. Documentado como limitação abaixo.
- `checklist_responses.answers` continua sendo substituído por inteiro a cada `PATCH` (não é um merge no banco); por isso o frontend sempre envia um snapshot completo com todas as respostas atuais mais a alterada, preservando o comportamento pré-existente.
- Publicar uma nova versão de template não afeta ordens de serviço já criadas — elas continuam referenciando `checklist_version_id` fixo (persistência da versão exata, já garantida desde a Fase 1). A nova versão só passa a valer para ordens futuras que a referenciem.
- Endpoints de `checklist-templates` usam a permissão `admin:manage_roles` (mesma já usada pelo catálogo administrativo), já que o catálogo de permissões não tem uma permissão dedicada para configuração de formulários e criar uma nova só para esta fatia pareceu escopo desnecessário.

## Limitações

- **Sem UI de autoria de templates**: a API de versionamento existe e está testada, mas não há tela no `apps/web` para um administrador criar/editar templates — hoje só é possível via API. Adicionado ao backlog.
- **Fotos e assinaturas não têm upload real**: o técnico/dispatcher só pode vincular um anexo que já existe na ordem (carregado via seed/fluxo futuro), não tirar uma foto ou desenhar uma assinatura na hora. Depende de uma infraestrutura de upload que ainda não existe no projeto.
- Validação de campos obrigatórios verifica só presença de resposta (não vazio/nulo), não regras de formato mais ricas que `form_fields.validation` poderia carregar (ex.: min/max numérico, regex) — o mecanismo de validação é extensível para isso depois, mas não foi implementado nesta fatia.

## Próxima fase

Fase 10 do roadmap mestre (Relatórios): cálculos de KPI no servidor e visualizações ECharts com filtros por data/região/equipe — ainda não iniciada.
