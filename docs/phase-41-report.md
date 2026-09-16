# Relatório da Fase 41

## Contexto

Este ambiente tinha uma `GROQ_API_KEY` real configurada em `.env`, algo que backlog item #29 apontava como nunca validado (o `CopilotService` só havia sido exercitado com o cliente Groq indefinido, caindo sempre no caminho heurístico). Como a chave estava disponível, esta fase aproveitou para fazer essa validação pontual — e encontrou dois bugs reais que só uma chamada de verdade à API da Groq conseguiria expor.

## Bugs encontrados e corrigidos

1. **Modelo `llama-3.3-70b-versatile` descontinuado pela Groq.** Uma chamada direta à API (`POST /openai/v1/chat/completions`) com esse modelo retornava `404 model_not_found`. Como `CopilotService.ask` engole qualquer erro de `askWithGroq` e cai no fallback heurístico (`apps/api/src/modules/copilot/copilot.service.ts`), isso nunca aparecia como erro — o copiloto simplesmente respondia sempre com `source: "heuristic"`, silenciosamente, para qualquer organização com uma chave Groq configurada e válida. Substituído por `openai/gpt-oss-120b` (confirmado via `GET /openai/v1/models` como um dos poucos modelos do tier gratuito que suportam `tools` + `json_object` ao mesmo tempo, os dois recursos que o copiloto usa).
2. **Contrato da ferramenta `get_dispatch_candidates` divergente entre o schema anunciado ao modelo e o código que a executa.** `packages/ai/src/index.ts` anunciava o parâmetro `workOrderId`, mas `copilot.service.ts` só sabia validar/usar `workOrderNumber` (`dispatchCandidatesToolInputSchema = z.object({ workOrderNumber: ... })`). Um modelo real, seguindo o contrato à risca, chamava a ferramenta com `{ workOrderId: ... }`, a validação Zod rejeitava por campo ausente, e o erro (não tratado como um caso normal) subia até `ask()` e caía no fallback heurístico. Esse bug é anterior a esta fase — só nunca tinha sido pego porque os testes automatizados chamam `executeTool` diretamente com o formato já correto (`{ workOrderNumber }`), nunca passando pelo schema JSON que de fato vai para o modelo. Corrigido alinhando o schema a `workOrderNumber`, que é também o único identificador que o modelo realmente tem em mãos (a saída de `get_sla_risk_work_orders` expõe `workOrderNumber`, não um id interno).

## Validação manual (contra a API real da Groq)

- `POST /copilot/ask` com uma pergunta genérica sobre risco de SLA → `source: "groq"`, ferramenta `get_sla_risk_work_orders` chamada corretamente, resposta estruturada e em português.
- `POST /copilot/ask` com uma pergunta que exige reatribuição → `source: "groq"`, loop de tool-use chamou `get_dispatch_candidates` com `workOrderNumber` corretamente, `suggestedAction` estruturado e válido contra o schema Zod.
- `POST /copilot/recommendations/:id/approve` na recomendação gerada pelo modelo real → criou um assignment de verdade (`demo-assignment-...`), fechando o ciclo completo (pergunta real → tool use real → estrutura validada → aprovação → efeito no despacho).

## Testes

- `pnpm verify`: lint + typecheck de 13 pacotes + 131 testes, todos passando.
- Dois testes de `auth.service.test.ts` (criados na Fase 40) se mostraram instáveis sob carga de CPU do ambiente — cada um encadeia de 3 a 6 operações `bcrypt` reais (custo 12) e passava perto do limite do timeout padrão de 5s do Vitest quando havia outros processos (servidores de dev) competindo por CPU. Corrigido aumentando o timeout desses 4 testes especificamente (`BCRYPT_HEAVY_TEST_TIMEOUT_MS = 15_000`) em vez de mockar `bcrypt`, para manter a cobertura contra o hashing real.

## Decisões

- Sem alterações de schema/dados: a correção ficou inteiramente no código (nome do modelo e nome do campo do schema JSON da ferramenta).
- Não foi adicionado nenhum teste automatizado que dependa de rede/chave real (mantém a disciplina já estabelecida do projeto) — a validação desta fase foi manual e pontual, exatamente como o item do backlog já prescrevia como critério de fechamento.

## Limitações

- Nenhuma nova. O item do backlog correspondente foi fechado nesta fase.
