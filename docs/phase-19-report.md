# Relatório da Fase 19

## Implementado

- Migração do copiloto de IA de `@anthropic-ai/sdk` para `groq-sdk`, seguindo a decisão de usar apenas serviços gratuitos (Groq, Vercel, Render, Neon, Upstash).
- `CopilotService` agora lê `GROQ_API_KEY` (antes `ANTHROPIC_API_KEY`) e usa o modelo `llama-3.3-70b-versatile`.
- Loop de tool-use reescrito no formato OpenAI-compatible da API da Groq (`tools` como `function`, mensagens `role: "tool"` com `tool_call_id`), mantendo o mesmo conjunto fechado de ferramentas somente leitura de `@fieldops/ai`.
- Saída estruturada final trocou o helper `zodOutputFormat` (exclusivo do SDK Anthropic) por `response_format: { type: "json_object" }` da Groq, com instrução explícita de schema no prompt e validação via `recommendationOutputSchema.parse` — se o JSON não bater com o schema, a chamada lança e cai no fallback heurístico já existente.
- Campo `source` de `CopilotRecommendation` (`packages/types`) e o rótulo na UI (`apps/web/src/app/copilot/page.tsx`) trocaram de `"claude"` para `"groq"`.

## Testes

- `pnpm --filter @fieldops/api typecheck` executado com sucesso.
- `pnpm --filter @fieldops/web typecheck` executado com sucesso.
- `pnpm --filter @fieldops/types typecheck` executado com sucesso.
- `pnpm vitest run apps/api/src/modules/copilot packages/ai packages/types`: 2 arquivos, 6 testes, todos passando (caminho heurístico, já que não há `GROQ_API_KEY` neste ambiente).

## Decisões

- Mantido o mesmo padrão da Fase 13: o serviço lê a credencial diretamente de `process.env`, sem passar pelo schema de ambiente do servidor (`packages/config`), porque é opcional e não deve travar o boot da API quando ausente.
- Sem `GROQ_API_KEY` configurada, o serviço continua caindo no caminho heurístico determinístico — nenhum comportamento observável muda para quem roda em modo demo.
- O prompt de saída estruturada foi escrito de forma explícita (schema descrito em texto) porque a Groq não tem um helper de parsing tipado equivalente ao `zodOutputFormat` da Anthropic; a validação real de forma continua sendo feita pelo Zod no lado do servidor.

## Limitações

- O caminho real do Groq (tool-use + JSON mode) ainda não foi exercitado contra a rede — falta configurar `GROQ_API_KEY` num ambiente com acesso à internet para validar manualmente (ver `docs/backlog.md`, item 29).
- `llama-3.3-70b-versatile` é o modelo escolhido por suportar tool-calling e JSON mode no free tier da Groq; não houve comparação formal de qualidade de resposta com outros modelos disponíveis no free tier.
