# Relatório — Roadmap Fase 12: Integrações

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre, seguindo o padrão dos relatórios anteriores (`roadmap-fase-06` a `roadmap-fase-11`).

## Implementado

- `packages/integrations`: `HttpMapsAdapter`, uma **fronteira de integração externa real** — chama um servidor OSRM (roteamento open-source, sem chave de API) por HTTP, implementando o mesmo contrato `MapsAdapter` já usado pelo `MockMapsAdapter` existente desde a Fase 3. `createMapsAdapter(baseUrl)` escolhe entre o adaptador real e o mock; `estimateRouteWithFallback(adapter, fallback, input)` tenta o adaptador principal e recorre ao mock em caso de falha — o mesmo padrão de degradação graciosa já usado em todo o projeto para Postgres/Redis.
- `packages/domain`: `scoreAssignmentCandidate` ganhou um fator opcional de deslocamento (`travelMinutes`) — penaliza levemente candidatos com deslocamento estimado acima de 30 minutos, com a mesma abordagem de pontuação explicável já usada para habilidades/território/carga.
- API — módulo `maps`: `MapsService.estimateTravelMinutes(origem, destino)` encapsula a seleção de adaptador (real quando `MAPS_PROVIDER_BASE_URL` está configurada, mock caso contrário) e o fallback.
- `DispatchService` (candidatos, caminho Postgres e modo demo) agora calcula o deslocamento estimado entre a casa do técnico (`technician_profiles.home_latitude/home_longitude`, já existente desde a Fase 1) e o local da ordem, usa isso na pontuação e expõe `estimatedTravelMinutes` em `DispatchCandidate` — fecha o item de backlog "Estimativas de rota/deslocamento no despacho" (origem: Fase 6).
- `packages/config`: nova variável opcional `MAPS_PROVIDER_BASE_URL`, documentada em `.env.example`.

## Testes

- Testes unitários novos em `packages/integrations`: seleção de adaptador (`createMapsAdapter`) e comportamento de fallback (`estimateRouteWithFallback`) usando um adaptador falso que falha propositalmente — **nenhum teste faz chamada de rede real**, mesma disciplina já usada para Postgres/Redis neste projeto.
- Testes unitários novos em `packages/domain` para a penalidade de deslocamento (`scoreAssignmentCandidate`).
- Testes unitários novos para `MapsService` (estimativa via mock, `null` quando falta origem/destino).
- Teste do `DispatchService` estendido para verificar que todo candidato retorna `estimatedTravelMinutes` numérico.
- `pnpm typecheck` (13 pacotes) e `pnpm test` (73 testes, 20 arquivos) executados com sucesso. `eslint` limpo nos arquivos alterados.
- Verificação manual ponta a ponta: chamei `GET /dispatch/candidates/:workOrderId` na API rodando de verdade e confirmei `estimatedTravelMinutes` presente e coerente (5–6 min entre as coordenadas demo) para os três técnicos, sem afetar a pontuação (abaixo do limiar de 30 min).
- Um bug real foi encontrado e corrigido antes mesmo de rodar os testes pela primeira vez: `MapsService` chamava `parseServerEnv` (que exige `DATABASE_URL`/`REDIS_URL`) só para ler sua própria variável opcional. Como os testes instanciam serviços diretamente com `new`, fora do bootstrap da API, e o ambiente de teste não define essas variáveis, `new MapsService()` teria lançado `ZodError` em qualquer teste que a construísse. Corrigido lendo `process.env.MAPS_PROVIDER_BASE_URL` diretamente, sem depender da validação completa do ambiente do servidor.

## Decisões

- **OSRM em vez de um provedor comercial**: não exige chave de API nem cadastro, o que mantém a fatia testável e demonstrável sem segredos. O contrato (`MapsAdapter`) é o mesmo independentemente do provedor, então trocar para Google Maps/Mapbox/HERE no futuro é só escrever outro `implements MapsAdapter` — o domínio (`DispatchService`, `scoreAssignmentCandidate`) nunca importa a classe HTTP diretamente.
- O adaptador de calendário (`CalendarAdapter`/`MockCalendarAdapter`, já existente desde a Fase 3) permanece não conectado a nenhum fluxo real — o prompt mestre pede "pelo menos uma" fronteira externa realista, e o foco desta fatia foi entregar essa uma fronteira (mapas/rotas) de ponta a ponta, conectada de verdade ao despacho, em vez de espalhar esforço por duas integrações superficiais.
- A penalidade de deslocamento na pontuação é deliberadamente pequena (-10, mesmo peso menor que carga de trabalho) e só se aplica acima de 30 minutos — evita que o fator dominasse o ranking antes de existir uma forma de calibrar isso com dados reais de campo.

## Limitações

- A UI de despacho (`/despacho`) ainda não consome `GET /dispatch/candidates/:id` nem exibe `estimatedTravelMinutes` — o endpoint existe e está correto, mas a integração visual continua no backlog (item "Preview de pontuação de candidato durante o drag", agora também cobrindo o tempo de deslocamento).
- `HttpMapsAdapter` não foi exercitado contra um servidor OSRM real nesta verificação (rede real é deliberadamente evitada em testes automatizados); o comportamento foi validado por injeção de dependência (adaptador falso) e pela leitura cuidadosa do código, seguindo a mesma disciplina de não testar rede real usada no resto do projeto.
- `CalendarAdapter`/`MockCalendarAdapter` continuam sem uso em nenhum fluxo da API.

## Próxima fase

Fase 13 do roadmap mestre (Copiloto de IA): ferramentas tipadas somente leitura, coleta de evidências, saída estruturada e trilha de auditoria, com aprovação humana para recomendações que alterem atribuição/agendamento — ainda não iniciada.
