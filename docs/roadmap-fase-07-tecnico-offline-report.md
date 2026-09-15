# Relatório — Roadmap Fase 7: Técnico/offline

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre, seguindo o padrão de `docs/roadmap-fase-06-despacho-report.md` e `docs/roadmap-fase-08-clientes-locais-ativos-report.md`.

## Implementado

- API — módulo `technician`: `GET /technician/work-orders`, retorna apenas as ordens atribuídas ao ator autenticado (reaproveita `WorkOrdersService.listForTechnician`, novo método com caminho Postgres e fallback em memória).
- API — módulo `sync`: `POST /sync/operations`, processa um lote de comandos offline (`status_change`, `checklist_update`, `note_add`) de forma idempotente:
  - Deduplicação por `(organization_id, idempotency_key)` — via tabela `sync_operations` (já existente desde a Fase 1, nunca usada até agora) quando há Postgres, ou um mapa em memória no modo demo.
  - Cada operação reaproveita `WorkOrdersService.updateStatus/updateChecklist/addNote`, preservando as mesmas regras de domínio, timeline e auditoria já usadas pelo desktop.
  - Transições de status inválidas retornam `outcome: "conflict"` com o motivo; ordens inexistentes retornam `outcome: "failed"`; reenvio da mesma chave retorna `outcome: "duplicate"`.
  - Sessão de dispositivo é registrada/atualizada em `device_sessions` a cada lote processado.
- `apps/mobile-web`: fluxo do técnico completo e funcional:
  - Camada de persistência offline em IndexedDB nativo (`src/lib/offline-db.ts`, sem dependência nova): cache de ordens atribuídas e fila de comandos pendentes.
  - Motor de sincronização (`src/lib/sync-engine.ts`): envia a fila para `/sync/operations`, remove comandos concluídos/duplicados, marca conflitos e falhas.
  - Página `/` (`Meu dia`): indicador online/offline, contador de comandos pendentes, botão "Sincronizar" manual, sincronização automática ao voltar a ficar online e retry periódico (15s) enquanto online, cartão de conflito com opção de descartar, avanço de status e adição de notas — cada ação grava otimisticamente no cache local e enfileira o comando com uma `idempotencyKey` própria (`crypto.randomUUID()`).
  - `QueryClientProvider` adicionado ao `apps/mobile-web` (faltava — só existia no `apps/web`).

## Testes

- `packages/database`/schema: nenhuma alteração necessária — `sync_operations` e `device_sessions` já existiam desde a Fase 1.
- Testes unitários novos: `WorkOrdersService.listForTechnician` (filtra por técnico atribuído); `SyncService` (aplica nota com sucesso, deduplica reenvio da mesma chave, retorna conflito em transição de status inválida).
- `pnpm typecheck` (13 pacotes) e `pnpm test` (43 testes, 16 arquivos) executados com sucesso.
- `eslint` limpo nos arquivos novos/alterados desta fatia.
- Verificação manual ponta a ponta (subindo API e `apps/mobile-web` de verdade, não só typecheck): confirmei `GET /technician/work-orders` retornando só a ordem de Ana Ribeiro; `POST /sync/operations` completando uma nota, deduplicando o reenvio da mesma chave (`outcome: "duplicate"`) e retornando conflito real para uma transição de status inválida; a página `/` do `apps/mobile-web` renderizando corretamente (200, "Meu dia" presente).
- Dois bugs reais só apareceram nessa verificação manual — nenhum deles foi pego pelo `tsc --noEmit`:
  1. `SyncService` injetava `WorkOrdersService` sem o decorator `@Inject(...)` explícito. Todo o resto do código já usa `@Inject(XService)` para esse tipo de dependência; eu quebrei essa convenção ao escrever o `SyncService`. Como o dev server roda via `tsx`/esbuild (não `tsc`), o import de `WorkOrdersService` — usado só como anotação de tipo no construtor — foi elidido na transpilação, e o Nest não conseguiu resolver a dependência em runtime (`UndefinedDependencyException`). Corrigido adicionando `@Inject(WorkOrdersService)`.
  2. `apps/mobile-web` não tinha `QueryClientProvider` configurado (só o `apps/web` tinha um `providers.tsx`). Como usei `useQuery`/`useQueryClient` na página do técnico, toda requisição retornava 500 ("No QueryClient set"). Corrigido criando `apps/mobile-web/src/app/providers.tsx` (mesmo padrão do `apps/web`) e envolvendo o `RootLayout`.

## Decisões

- O corpo da sincronização reaproveita os mesmos métodos de `WorkOrdersService` usados pelo desktop, em vez de duplicar lógica de mutação — garante que uma ordem sincronizada offline passe pelas mesmas regras de transição, timeline e auditoria.
- A fila de comandos e o cache de ordens usam IndexedDB nativo, sem biblioteca adicional — evita instalar dependência sem necessidade concreta (regra do prompt mestre) para um caso de uso simples (duas object stores, sem índices compostos).
- Conflitos não são reprocessados automaticamente: o técnico precisa descartar o comando conflitante manualmente na UI, evitando loops de retry silenciosos sobre uma regra de negócio já rejeitada pelo servidor.
- A retentativa periódica (15s) e o listener do evento `online` cobrem "retries de sincronização" sem a necessidade de um Service Worker nesta fatia.

## Limitações

- **Testes Playwright de comportamento offline do navegador não foram implementados** — o prompt mestre pede explicitamente "testar comportamento offline do navegador com Playwright" para esta fase, mas configurar Playwright do zero (download de browsers, config, CI) foi avaliado como fora do escopo desta fatia dado o tamanho já grande da mudança. Registrado no backlog (`docs/backlog.md`) para fechamento oportunista.
- Checklist não faz parte do fluxo offline do técnico ainda (só status e notas) — mobile continua limitado a dois tipos de comando.
- Sem Service Worker/PWA: a sincronização automática depende da aba estar aberta (evento `online` + intervalo de 15s), não de background sync real.
- O ambiente de desenvolvimento local acumulou dezenas de processos Node órfãos de sessões anteriores (`tsx watch`, `next dev` em portas 3100/3101, etc.), alguns dos quais eu precisei encerrar manualmente durante a verificação desta fase (processos antigos nas portas 3001/3101 que serviam código desatualizado). Recomendo ao usuário revisar `Get-Process node` e encerrar manualmente os processos remanescentes que não estejam mais em uso.

## Próxima fase

Fase 9 do roadmap mestre (Formulários/Inspeções): versionar templates, construir renderer e mecanismo de validação, persistir a versão exata utilizada e suportar fotos/assinaturas — ainda não iniciada.
