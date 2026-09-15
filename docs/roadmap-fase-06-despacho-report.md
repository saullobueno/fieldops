# Relatório — Roadmap Fase 6: Despacho

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre para evitar ambiguidade, seguindo o padrão já usado em `docs/roadmap-fase-08-clientes-locais-ativos-report.md`.

## Implementado

- `packages/domain`: `scoreAssignmentCandidate` (pontuação de atribuição por habilidades, território e carga de trabalho, com explicação textual) e `hasScheduleConflict` (detecção de sobreposição de janelas de horário), como funções puras e testadas isoladamente — conforme a regra do prompt mestre de manter a pontuação de atribuição como serviço de domínio testado.
- Módulo `dispatch` na API:
  - `GET /dispatch/board?date=` — retorna as faixas de técnicos (com suas atribuições do dia) e a fila de ordens ainda não atribuídas, protegido por `schedule:read`.
  - `GET /dispatch/candidates/:workOrderId` — candidatos a técnico ranqueados por pontuação, com explicação e sinalização de conflito, protegido por `work_order:assign`.
  - `POST /dispatch/assignments` — cria a atribuição de forma transacional: verifica conflito de horário do técnico, calcula a pontuação, cancela qualquer atribuição ativa anterior da ordem, grava `work_order_assignments`, `schedule_slots`, evento de timeline e log de auditoria (`assign`). Retorna 409 quando há conflito de horário.
  - Ambos os caminhos (Postgres e fallback em memória) compartilham a mesma lógica de domínio para pontuação e conflito.
- Página `/despacho`: fila de ordens não atribuídas (cartões arrastáveis) e faixas de técnicos (áreas de soltar) usando `@dnd-kit/core`; ao soltar uma ordem sobre um técnico, dispara a atribuição via API e trata conflito de horário com mensagem inline.
- Link "Despacho" no `AppShell` agora aponta para `/despacho`.

## Testes

- Testes unitários novos em `packages/domain` para `scoreAssignmentCandidate` (máximo, penalidade de carga/habilidade, piso em zero) e `hasScheduleConflict` (sobreposição parcial e janelas adjacentes).
- Testes unitários novos para `DispatchService` (board demo, ranking de candidatos, criação de atribuição movendo a ordem da fila).
- `pnpm typecheck` (13 pacotes) e `pnpm test` (39 testes, 15 arquivos) executados com sucesso.
- `eslint` limpo nos arquivos novos/alterados desta fatia.
- Verificação manual ponta a ponta: subi a API e o `apps/web`, chamei `GET /dispatch/board`, `GET /dispatch/candidates/:id` e `POST /dispatch/assignments` via `curl` confirmando o ranking (Carla Nunes com maior pontuação por habilidade+território) e a atribuição movendo a ordem da fila para a faixa do técnico. A página `/despacho` renderiza sem erros de servidor/runtime.

## Decisões

- A janela de horário da atribuição (`startsAt`/`endsAt`) é derivada do próprio agendamento da ordem de serviço (`scheduled_start_at`/`scheduled_end_at`), não informada pelo cliente — evita a necessidade de um seletor de horário nesta fatia e mantém o servidor como única fonte de verdade para o conflito.
- Criar uma nova atribuição cancela automaticamente qualquer atribuição ativa anterior da mesma ordem, mantendo no máximo uma atribuição ativa por ordem de serviço.
- A autorização de `POST /dispatch/assignments` usa apenas a permissão `work_order:assign` mais o escopo de organização embutido nas consultas (sem checagem estrita de equipe/território como em ordens de serviço), pois o despacho é, por natureza, uma ação de escopo amplo do dispatcher sobre ordens ainda não atribuídas a ninguém.
- `@dnd-kit/core` foi adicionado como dependência do `apps/web` — é a biblioteca de drag-and-drop já prevista na arquitetura alvo do prompt mestre.

## Limitações

- O mapa de serviços ativos e as estimativas de rota/deslocamento ainda não estão integrados à tela de despacho (o `packages/maps` continua sendo apenas um contrato de coordenadas).
- Não há seleção de data na UI — a tela sempre usa o dia atual do servidor.
- O drag-and-drop não oferece pré-visualização da pontuação do candidato durante o arraste; o endpoint de candidatos existe mas ainda não está conectado à interação de arrastar.
- Não foi possível reproduzir o conflito de horário (409) end-to-end nos dados demo por só existir uma ordem não atribuída sem sobreposição com as atribuições existentes; a lógica está coberta por testes unitários diretos de `hasScheduleConflict` e pelo caminho de código do `DispatchService`.

## Próxima fase

Fase 7 do roadmap mestre (Técnico/offline): fluxo mobile responsivo, persistência em IndexedDB, fila de comandos, idempotência, retries de sincronização e UI de conflitos — ainda não iniciada.
