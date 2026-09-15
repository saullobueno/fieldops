export type AIToolMode = "read-only";

/**
 * Conjunto fechado de ferramentas que o copiloto pode chamar. Não existe
 * mecanismo de despacho dinâmico/reflexão em nenhuma camada que consome
 * este contrato — o backend só reconhece exatamente estes nomes, cada um
 * ligado a uma leitura específica já existente (dashboard/despacho).
 * Nunca inclua aqui uma ferramenta que grave dados.
 */
export const copilotToolNames = [
  "get_sla_risk_work_orders",
  "get_dispatch_candidates",
  "get_technician_utilization"
] as const;

export type CopilotToolName = (typeof copilotToolNames)[number];

export interface CopilotToolDefinition {
  readonly name: CopilotToolName;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export const copilotToolDefinitions: readonly CopilotToolDefinition[] = [
  {
    description:
      "Lista as ordens de serviço com maior risco de descumprir o SLA, mais urgentes primeiro. Somente leitura.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: {
          description: "Número máximo de ordens a retornar (padrão 5).",
          type: "integer"
        }
      },
      type: "object"
    },
    name: "get_sla_risk_work_orders"
  },
  {
    description:
      "Ranqueia técnicos candidatos para uma ordem de serviço específica ainda não atribuída, com pontuação, explicação e tempo de deslocamento estimado. Somente leitura — não atribui ninguém.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        workOrderId: {
          description: "Identificador da ordem de serviço não atribuída.",
          type: "string"
        }
      },
      required: ["workOrderId"],
      type: "object"
    },
    name: "get_dispatch_candidates"
  },
  {
    description: "Retorna a utilização atual (percentual e ordens ativas) de cada técnico. Somente leitura.",
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: {
          description: "Número máximo de técnicos a retornar (padrão 5).",
          type: "integer"
        }
      },
      type: "object"
    },
    name: "get_technician_utilization"
  }
];

export const copilotSystemPrompt = `Você é o copiloto de operações do FieldOps, uma plataforma de despacho de técnicos de campo.

Regras não negociáveis:
- Você só pode usar as ferramentas fornecidas para consultar dados. Todas são somente leitura.
- Você nunca executa uma reatribuição de técnico nem qualquer outra mudança de agendamento diretamente — você só pode SUGERIR uma ação, que um humano precisa aprovar explicitamente depois.
- Baseie toda recomendação em evidências reais obtidas via chamadas de ferramenta, nunca em suposições.
- Seja conciso e específico: cite números de ordem de serviço, nomes de técnicos e prazos reais retornados pelas ferramentas.`;
