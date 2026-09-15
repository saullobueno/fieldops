# Relatório — Roadmap Fase 13: Copiloto de IA

Nota de numeração: os relatórios `docs/phase-N-report.md` (0 a 18) seguem uma sequência cronológica própria de fatias de aprofundamento, não a numeração das 18 fases do roadmap mestre (`FIELDOPS-CLAUDE-CODE-PROMPT.md`). Este relatório usa o nome da fase mestre, seguindo o padrão dos relatórios anteriores (`roadmap-fase-06` a `roadmap-fase-12`).

## Implementado

- `packages/ai`: conjunto **fechado** de 3 ferramentas somente leitura (`get_sla_risk_work_orders`, `get_dispatch_candidates`, `get_technician_utilization`), cada uma com nome, descrição e JSON Schema de entrada. Não existe nenhum mecanismo de despacho dinâmico/reflexão em nenhuma camada — o backend reconhece exatamente esses três nomes via `switch` exaustivo; qualquer nome fora do conjunto é rejeitado com 400 antes de qualquer execução.
- `packages/domain`: `requiresHumanApproval`/`aiActionsRequiringApproval` — função pura que marca quais tipos de ação sugerida pela IA exigem aprovação humana (hoje só `reassign_technician`, mas extensível).
- API — módulo `copilot`, usando o **SDK oficial da Anthropic** (`@anthropic-ai/sdk`):
  - `POST /copilot/ask`: roda um loop manual de tool-use (`claude-opus-5`) com as três ferramentas acima, cada chamada de ferramenta reaproveitando serviços já existentes e testados (`DashboardService`, `DispatchService`, `WorkOrdersService`) — nunca escreve, só lê. Ao final, uma chamada `client.messages.parse()` com `output_config.format` (via `zodOutputFormat`) produz uma recomendação estruturada e validada (`title`, `summary`, `suggestedAction | null`).
  - Quando `ANTHROPIC_API_KEY` não está configurada (como neste ambiente), cai para um **fallback heurístico determinístico** que chama as mesmas ferramentas sem nenhum modelo de linguagem — mesmo padrão de degradação graciosa já usado no `MapsService` (Fase 12) e em toda a base.
  - `POST /copilot/recommendations/:id/approve`: exige a permissão `work_order:assign` e **nunca executa a reatribuição sozinho** — só reage a uma aprovação humana explícita, reaproveitando `DispatchService.createAssignment` (mesma validação de conflito, pontuação e evento em tempo real já existentes) e gravando uma entrada suplementar em `audit_logs` com `source: "ai-copilot"` e o id da recomendação.
  - Evidência de cada chamada de ferramenta e a conversa são persistidas em `ai_conversations`/`ai_tool_calls` (tabelas já existentes desde a Fase 1, nunca usadas até agora) quando há Postgres disponível — melhor esforço, não bloqueia a resposta.
- `apps/web`: nova página `/copilot` — campo de pergunta com sugestões rápidas, exibição da recomendação (título, resumo, origem "Claude" vs. "Heurística demo"), lista expansível de evidências (cada ferramenta chamada com seu resultado bruto), e card de ação sugerida com botão "Aprovar reatribuição" — nada é alterado sem esse clique explícito.

## Testes

- Teste unitário novo em `packages/domain` para `requiresHumanApproval`.
- Testes unitários novos em `packages/ai` garantindo que o conjunto de ferramentas definidas bate exatamente com o conjunto fechado de nomes, e que todo schema de entrada é um objeto com `additionalProperties: false`.
- Testes unitários novos para `CopilotService`: caminho heurístico coletando evidência real de risco de SLA; rejeição de aprovação sem ação sugerida; rejeição de aprovação de recomendação inexistente; e um teste de ponta a ponta do caminho de sucesso (sugestão de reatribuição + aprovação real via `DispatchService.createAssignment` + bloqueio de reaprovação) usando dados demo alinhados por mock.
- `pnpm typecheck` (13 pacotes), `pnpm test` (80 testes, 22 arquivos) e `eslint` (arquivos alterados) executados com sucesso.
- Verificação manual ponta a ponta com a API rodando de verdade: `POST /copilot/ask` retornou uma recomendação real citando WO-1002 com evidência de `get_sla_risk_work_orders`; `POST /copilot/recommendations/:id/approve` rejeitou corretamente uma recomendação sem ação (400 "não possui uma ação") e um id inexistente (404 "não encontrada"). A página `/copilot` renderiza sem erros — confirmado tanto pelo HTML quanto pelo log de desenvolvimento do Next.js.
- **Nenhum teste faz chamada de rede real à Anthropic** — `ANTHROPIC_API_KEY` está vazia neste ambiente, então todo o caminho `askWithClaude`/SDK real foi validado apenas por leitura cuidadosa do código e pelo compilador, nunca executado de fato. Ver limitação abaixo.

## Decisões

- Dois bugs reais foram encontrados e corrigidos antes mesmo de rodar os testes:
  1. **Assinatura do `zodOutputFormat`**: a documentação genérica sugeria `zodOutputFormat(schema, "nome")`, mas a versão instalada do SDK (`@anthropic-ai/sdk@0.125.0`) aceita só o schema como argumento — o segundo parâmetro não existe nesta versão. Pego imediatamente pelo `tsc`, sem precisar de nenhuma chamada de rede para descobrir.
  2. **Datasets demo desalinhados entre serviços**: o item de maior risco de SLA no `DashboardService` demo (`WO-1002`) não existe no conjunto de ordens não atribuídas do `DispatchService` demo (só `WO-1003`), e o `WorkOrdersService` demo por sua vez não conhece `WO-1003`. Resultado: em modo 100% demo (sem Postgres), o encadeamento heurístico "risco de SLA → candidatos de despacho" quase sempre cai para "sem sugestão de ação" — comportamento correto e tratado com `try/catch`, mas só descobri o alcance real do problema ao tentar escrever o teste do caminho de sucesso, que precisou de mocks explícitos para alinhar os dois datasets.
- O copiloto só pode **sugerir**, nunca executar, uma reatribuição — meta-regra não negociável do prompt mestre. Isso é garantido estruturalmente: `askWithClaude`/`askWithHeuristics` só retornam um `CopilotRecommendation`; a única função que chama `DispatchService.createAssignment` é `approve()`, que exige um `recommendationId` já existente E a permissão `work_order:assign` do ator autenticado.
- Recomendações pendentes de aprovação são mantidas em um `Map` em memória por processo (chaveado por id, escopado por organização), não em uma tabela — o schema não prevê uma tabela para isso (só `ai_conversations`/`ai_tool_calls`, usadas para a conversa/evidência). Documentado como limitação abaixo.
- A ferramenta `get_dispatch_candidates` recebe `workOrderNumber` (não um id interno) porque é isso que aparece nos dados de risco de SLA e no vocabulário natural de uma pergunta do dispatcher; a resolução para o id real acontece via `WorkOrdersService.list({search})`, reaproveitando a busca já existente em vez de expor IDs internos ao modelo.

## Limitações

- **Recomendações só em memória, por processo** — origem desta fase. Reiniciar a API descarta recomendações pendentes de aprovação. Fechamento: adicionar uma tabela dedicada (ex.: `ai_recommendations`) quando o volume de uso justificar persistência entre reinícios.
- **Datasets demo de dashboard/despacho não são cross-referenciados** — origem desta fase, evidenciada ao testar o copiloto. Em modo 100% demo (sem Postgres), o item de maior risco de SLA raramente encadeia numa sugestão concreta de reatribuição. Com Postgres real, os dados vêm das mesmas tabelas e o problema não existe.
- **Caminho real do SDK da Anthropic nunca exercitado contra a rede** — não há `ANTHROPIC_API_KEY` configurada neste ambiente; o loop de tool-use real e a saída estruturada via `client.messages.parse()` foram validados por tipos e revisão de código, não por execução. Fechamento: validação manual pontual ao configurar a chave em um ambiente com acesso à internet.
- O copiloto só sugere reatribuição de técnico (`reassign_technician`); não sugere reagendamento, criação de ordens nem qualquer outra ação — escopo mínimo deliberado desta fase.

## Próxima fase

Fase 14 do roadmap mestre (Notificações): central de notificações, preferências e adaptadores de provedores — ainda não iniciada.
