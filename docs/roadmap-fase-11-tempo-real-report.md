# Relatório — Roadmap Fase 11: Tempo Real

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre, seguindo o padrão dos relatórios anteriores (`roadmap-fase-06` a `roadmap-fase-10`).

## Implementado

- `packages/domain`: `calculateReconnectDelayMs` (backoff exponencial com teto de 30s) e `isRealtimeConnectionStale` (detecção de conexão desatualizada por ausência de eventos), puras e testadas.
- `packages/types`: contrato tipado de eventos (`RealtimeEvent`, união discriminada de `work_order_status_changed`, `assignment_created`, `technician_location_updated`, `notification_created`) e `RealtimeEnvelope` (id, `occurredAt`, `organizationId`, evento).
- API — módulo `realtime`: usa **SSE nativo do NestJS** (`@Sse()`), não WebSocket/socket.io — não exige nenhuma dependência nova, ao contrário de `@nestjs/websockets`. `RealtimeService` é um pub/sub em memória (Node `EventEmitter`) por organização, exportado para outros módulos publicarem eventos.
  - `GET /realtime/stream` — conexão SSE de longa duração; envia um evento de conexão imediatamente e heartbeat a cada 20s.
  - `POST /realtime/technician-location` — permite que um técnico publique sua localização (lat/lng), autenticado normalmente via headers.
- `WorkOrdersService.updateStatus` e `DispatchService.createAssignment` (caminho Postgres e modo demo) agora publicam `work_order_status_changed`/`assignment_created` após a mutação ter sucesso — estado dos serviços e atribuições ficam observáveis em tempo real.
- `apps/web`: hook `useRealtimeStream` conectando via `EventSource` nativo, com reconexão usando backoff exponencial e detecção de conexão desatualizada (usando as funções de domínio). A página Início (`/`) ganhou um indicador de status ("Ao vivo" / "Conectando..." / "Reconectando..." / "Desatualizado") e um painel de eventos recentes; a chegada de qualquer evento invalida as queries do dashboard para refletir mudanças sem recarregar a página.

## Testes

- Testes unitários novos em `packages/domain`: `calculateReconnectDelayMs` (dobra a cada tentativa, teto de 30s, tentativa negativa tratada como zero) e `isRealtimeConnectionStale` (dentro/fora do limite de 45s).
- Testes unitários novos para `RealtimeService`: evento de conexão imediato ao assinar, e isolamento por organização (evento publicado para outra organização não vaza para o assinante).
- Teste do `DispatchService` estendido para verificar que `assignment_created` é publicado ao criar uma atribuição.
- `pnpm typecheck` (13 pacotes) e `pnpm test` (65 testes, 19 arquivos) executados com sucesso.
- `eslint` limpo nos arquivos novos/alterados.
- Verificação manual ponta a ponta com a API rodando de verdade: conectei ao `GET /realtime/stream` via `curl -N` e confirmei, em tempo real, a chegada do evento de conexão, de `work_order_status_changed` (ao mudar o status de uma ordem via `PATCH`), de `assignment_created` (ao despachar via `POST /dispatch/assignments`) e de `technician_location_updated` (via `POST /realtime/technician-location`) — todos com o payload correto. Confirmei também a rejeição com 403 quando a permissão `work_order:read` não é informada. A página Início renderiza sem erros após corrigir os dois bugs abaixo.

## Decisões

- **SSE em vez de WebSocket**: o prompt mestre aceita WebSocket *ou* SSE. SSE nativo do NestJS (`@Sse()` + `Observable<MessageEvent>`) não exige nenhuma biblioteca nova (`rxjs` já é dependência do Nest), enquanto WebSocket exigiria `@nestjs/websockets` + `socket.io`. Para o caso de uso (eventos unidirecionais servidor→cliente), SSE é suficiente e mais simples — reconexão automática é nativa do protocolo/`EventSource`.
- **Autenticação do stream via query string, não headers**: `EventSource` não permite definir cabeçalhos customizados (limitação do próprio navegador), então `GET /realtime/stream` é a única rota do projeto que resolve o ator a partir de `?organizationId=&permissions=` em vez do `AuthGuard` baseado em `x-fieldops-*` headers usado em todas as outras rotas. Documentado explicitamente no código com um comentário explicando o motivo.
- Dois bugs reais foram encontrados e corrigidos durante a implementação, nenhum pego pelo `tsc --noEmit`:
  1. O `MessageEvent` do NestJS inicialmente incluía `type: envelope.event.type`. No SSE, um campo `type` customizado faz o navegador tratar o evento como **nomeado**, que só dispara `addEventListener(tipo, ...)` — nunca `onmessage`. Como o hook do cliente usa `onmessage` (mais simples, um único listener para todos os tipos de evento de domínio), os eventos nunca teriam chegado. Corrigido removendo `type` do `MessageEvent` e deixando o tipo do evento de domínio viajar dentro do payload JSON (`envelope.event.type`), lido pelo cliente.
  2. Ao registrar o teste do evento de conexão imediata, o próprio teste tinha um bug de *temporal dead zone* (`subscription.unsubscribe()` referenciado antes de `const subscription` ser inicializado), porque a emissão inicial do `RealtimeService.stream()` é síncrona. Corrigido declarando a variável com `let` antes do `subscribe`.
  3. Depois de adicionar `@fieldops/domain` como dependência do `apps/web`, o processo `next dev` que já estava rodando (de uma sessão anterior) não pegou o novo link do workspace — mesma classe de problema já vista na Fase 7 com o `apps/mobile-web`. Corrigido reiniciando o processo.

## Limitações

- Notificações (`notification_created`) só são emitidas pelo próprio sistema de conexão (mensagem "Conexão estabelecida"); não há ainda uma central de notificações real gerando esse tipo de evento — isso é escopo da Fase 14 (Notificações), que ainda não começou.
- O pub/sub é em memória, por processo — funciona para uma única instância da API. Em produção com múltiplas instâncias, seria necessário um broker compartilhado (Redis pub/sub, que já está disponível como dependência de infraestrutura do projeto, mas não foi conectado ao `RealtimeService` nesta fatia).
- `technician-location` não persiste a localização em nenhuma tabela — apenas publica o evento. Não há histórico de localização nem exibição no mapa do despacho/dashboard ainda.
- A UI só consome eventos em tempo real na página Início; despacho e ordens de serviço continuam dependendo de refetch manual/polling do TanStack Query.

## Próxima fase

Fase 12 do roadmap mestre (Integrações): contratos de adaptadores e mock primeiro, com pelo menos uma fronteira de integração externa realista sem acoplar o domínio às APIs do fornecedor — ainda não iniciada.
