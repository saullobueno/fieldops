import { randomUUID } from "node:crypto";

import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";
import Groq from "groq-sdk";
import type { AuthenticatedActor } from "@fieldops/auth";
import { copilotSystemPrompt, copilotToolDefinitions, copilotToolNames, type CopilotToolName } from "@fieldops/ai";
import type {
  CopilotApprovalResult,
  CopilotRecommendation,
  CopilotSuggestedAction,
  CopilotToolCallEvidence,
  DispatchCandidate,
  SlaRiskItem,
  TechnicianUtilizationItem
} from "@fieldops/types";
import type pg from "pg";
import { z } from "zod";

import { DashboardService } from "../dashboard/dashboard.service.js";
import { DispatchService } from "../dispatch/dispatch.service.js";
import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";
import { WorkOrdersService } from "../work-orders/work-orders.service.js";

// llama-3.3-70b-versatile foi descontinuado pela Groq (confirmado em produção
// na Fase 41: a chave real retornava 404 "model_not_found", fazendo o
// copiloto cair sempre no fallback heurístico silenciosamente). gpt-oss-120b
// é o substituto atual com suporte a tool use + json_mode no tier gratuito.
const MODEL = "openai/gpt-oss-120b";
const MAX_TOOL_ITERATIONS = 6;
const MAX_OUTPUT_TOKENS = 4_096;

const STRUCTURED_OUTPUT_INSTRUCTIONS =
  'Com base apenas nas evidências já coletadas pelas ferramentas, responda SOMENTE com um objeto JSON válido, sem nenhum texto antes ou depois, exatamente neste formato: {"title": string, "summary": string, "suggestedAction": null | {"type": "reassign_technician", "workOrderId": string, "workOrderNumber": string, "technicianId": string, "technicianName": string, "reason": string}}. Se não houver uma ação clara a sugerir, use "suggestedAction": null. Responda em português (pt-BR).';

const recommendationOutputSchema = z.object({
  suggestedAction: z
    .object({
      reason: z.string(),
      technicianId: z.string(),
      technicianName: z.string(),
      type: z.literal("reassign_technician"),
      workOrderId: z.string(),
      workOrderNumber: z.string()
    })
    .nullable(),
  summary: z.string(),
  title: z.string()
});

const slaRiskToolInputSchema = z.object({ limit: z.number().int().min(1).max(20).optional() });
const dispatchCandidatesToolInputSchema = z.object({ workOrderNumber: z.string().trim().min(1) });
const technicianUtilizationToolInputSchema = z.object({ limit: z.number().int().min(1).max(20).optional() });

interface StoredRecommendation {
  readonly organizationId: string;
  readonly recommendation: CopilotRecommendation;
}

interface RecommendationRow {
  readonly id: string;
  readonly conversation_id: string;
  readonly question: string;
  readonly title: string;
  readonly summary: string;
  readonly source: "groq" | "heuristic";
  readonly suggested_action: CopilotSuggestedAction | null;
  readonly evidence: readonly CopilotToolCallEvidence[];
  readonly requires_approval: boolean;
  readonly approved_at: Date | string | null;
  readonly created_at: Date | string;
}

const recommendationStore = new Map<string, StoredRecommendation>();

@Injectable()
export class CopilotService {
  private readonly client: Groq | undefined;

  constructor(
    @Inject(DashboardService) private readonly dashboardService: DashboardService,
    @Inject(DispatchService) private readonly dispatchService: DispatchService,
    @Inject(WorkOrdersService) private readonly workOrdersService: WorkOrdersService,
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool
  ) {
    // Lê só a credencial que este serviço precisa, sem validar o ambiente
    // completo do servidor (mesma lição da Fase 12 com o MapsService).
    const apiKey = process.env.GROQ_API_KEY;
    this.client = apiKey ? new Groq({ apiKey }) : undefined;
  }

  async ask(actor: AuthenticatedActor, question: string): Promise<CopilotRecommendation> {
    const trimmedQuestion = question.trim();

    if (!this.client) {
      return this.askWithHeuristics(actor, trimmedQuestion);
    }

    try {
      return await this.askWithGroq(actor, trimmedQuestion);
    } catch {
      return this.askWithHeuristics(actor, trimmedQuestion);
    }
  }

  async approve(actor: AuthenticatedActor, recommendationId: string): Promise<CopilotApprovalResult> {
    const recommendation = await this.loadRecommendation(actor, recommendationId);

    if (!recommendation) {
      throw new NotFoundException("Recomendação não encontrada.");
    }

    if (recommendation.approvedAt) {
      throw new BadRequestException("Esta recomendação já foi aprovada.");
    }

    const action = recommendation.suggestedAction;
    if (!action) {
      throw new BadRequestException("Esta recomendação não possui uma ação para aprovar.");
    }

    const assignment = await this.dispatchService.createAssignment({
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      technicianId: action.technicianId,
      workOrderId: action.workOrderId
    });

    const approvedAt = new Date().toISOString();
    const approvedRecommendation: CopilotRecommendation = { ...recommendation, approvedAt };
    recommendationStore.set(recommendationId, { organizationId: actor.organizationId, recommendation: approvedRecommendation });
    await this.persistApproval(actor, recommendationId, approvedAt);

    await this.recordApprovalAudit(actor, approvedRecommendation);

    return {
      assignmentId: assignment.assignmentId,
      recommendationId,
      technicianId: action.technicianId,
      workOrderId: action.workOrderId
    };
  }

  /**
   * O `Map` em memória é o caminho rápido (evita ler o próprio insert logo em seguida);
   * o Postgres é a fonte de verdade que sobrevive a um restart da API.
   */
  private async loadRecommendation(
    actor: AuthenticatedActor,
    recommendationId: string
  ): Promise<CopilotRecommendation | undefined> {
    const cached = recommendationStore.get(recommendationId);
    if (cached && cached.organizationId === actor.organizationId) {
      return cached.recommendation;
    }

    if (!this.postgresPool) {
      return undefined;
    }

    try {
      const result = await this.postgresPool.query<RecommendationRow>(
        `select id, conversation_id, question, title, summary, source, suggested_action, evidence, requires_approval, approved_at, created_at
         from ai_recommendations
         where id = $1 and organization_id = $2`,
        [recommendationId, actor.organizationId]
      );

      const row = result.rows[0];
      if (!row) {
        return undefined;
      }

      const recommendation = toRecommendation(row);
      recommendationStore.set(recommendationId, { organizationId: actor.organizationId, recommendation });
      return recommendation;
    } catch {
      return undefined;
    }
  }

  private async askWithGroq(actor: AuthenticatedActor, question: string): Promise<CopilotRecommendation> {
    const client = this.client!;
    const evidence: CopilotToolCallEvidence[] = [];
    const tools: Groq.Chat.Completions.ChatCompletionTool[] = copilotToolDefinitions.map((tool) => ({
      function: {
        description: tool.description,
        name: tool.name,
        parameters: tool.inputSchema
      },
      type: "function"
    }));

    let messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { content: copilotSystemPrompt, role: "system" },
      { content: question, role: "user" }
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      const response = await client.chat.completions.create({
        max_tokens: MAX_OUTPUT_TOKENS,
        messages,
        model: MODEL,
        tools
      });

      const message = response.choices[0]?.message;
      if (!message) {
        break;
      }

      messages = [...messages, message];

      const toolCalls = message.tool_calls ?? [];
      if (toolCalls.length === 0) {
        break;
      }

      for (const call of toolCalls) {
        if (call.type !== "function") {
          continue;
        }

        const rawInput: unknown = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        const output = await this.executeTool(call.function.name, rawInput, actor);
        evidence.push({ input: rawInput as Record<string, unknown>, output, toolName: call.function.name });
        messages = [...messages, { content: JSON.stringify(output), role: "tool", tool_call_id: call.id }];
      }
    }

    const finalResponse = await client.chat.completions.create({
      max_tokens: 2_048,
      messages: [...messages, { content: STRUCTURED_OUTPUT_INSTRUCTIONS, role: "user" }],
      model: MODEL,
      response_format: { type: "json_object" }
    });

    const rawContent = finalResponse.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("O modelo não retornou uma recomendação estruturada válida.");
    }

    const parsed = recommendationOutputSchema.parse(JSON.parse(rawContent));

    return this.buildAndStoreRecommendation({
      actor,
      evidence,
      question,
      source: "groq",
      suggestedAction: parsed.suggestedAction,
      summary: parsed.summary,
      title: parsed.title
    });
  }

  private async askWithHeuristics(actor: AuthenticatedActor, question: string): Promise<CopilotRecommendation> {
    const evidence: CopilotToolCallEvidence[] = [];

    const slaRiskOutput = await this.executeTool("get_sla_risk_work_orders", { limit: 1 }, actor);
    evidence.push({ input: { limit: 1 }, output: slaRiskOutput, toolName: "get_sla_risk_work_orders" });

    const topRisk = (slaRiskOutput.items as readonly SlaRiskItem[])[0];

    if (!topRisk) {
      return this.buildAndStoreRecommendation({
        actor,
        evidence,
        question,
        source: "heuristic",
        suggestedAction: null,
        summary: "Não há ordens de serviço com risco relevante de descumprir o SLA no momento.",
        title: "Nenhum risco de SLA identificado"
      });
    }

    let candidatesOutput: Record<string, unknown> | undefined;
    try {
      candidatesOutput = await this.executeTool(
        "get_dispatch_candidates",
        { workOrderNumber: topRisk.workOrderNumber },
        actor
      );
      evidence.push({
        input: { workOrderNumber: topRisk.workOrderNumber },
        output: candidatesOutput,
        toolName: "get_dispatch_candidates"
      });
    } catch {
      candidatesOutput = undefined;
    }

    const candidates = (candidatesOutput?.candidates ?? []) as readonly DispatchCandidate[];
    const bestCandidate = [...candidates].filter((item) => !item.hasConflict).sort((a, b) => b.score - a.score)[0];

    const baseSummary = `${topRisk.workOrderNumber} (${topRisk.customer}) tem risco ${topRisk.risk} de descumprir o SLA, com vencimento às ${topRisk.dueAt}.`;

    if (!bestCandidate || !candidatesOutput) {
      return this.buildAndStoreRecommendation({
        actor,
        evidence,
        question,
        source: "heuristic",
        suggestedAction: null,
        summary: baseSummary,
        title: `Atenção ao SLA de ${topRisk.workOrderNumber}`
      });
    }

    const suggestedAction: CopilotSuggestedAction = {
      reason: `Maior pontuação (${bestCandidate.score}) entre os técnicos sem conflito de agenda para esta ordem.`,
      technicianId: bestCandidate.technicianId,
      technicianName: bestCandidate.technicianName,
      type: "reassign_technician",
      workOrderId: String(candidatesOutput.workOrderId),
      workOrderNumber: topRisk.workOrderNumber
    };

    return this.buildAndStoreRecommendation({
      actor,
      evidence,
      question,
      source: "heuristic",
      suggestedAction,
      summary: `${baseSummary} ${bestCandidate.technicianName} é o candidato mais adequado (pontuação ${bestCandidate.score}).`,
      title: `Reatribuir ${topRisk.workOrderNumber} para ${bestCandidate.technicianName}`
    });
  }

  private async executeTool(
    name: string,
    rawInput: unknown,
    actor: AuthenticatedActor
  ): Promise<Record<string, unknown>> {
    if (!isCopilotToolName(name)) {
      throw new BadRequestException(`Ferramenta desconhecida: ${name}.`);
    }

    switch (name) {
      case "get_sla_risk_work_orders": {
        const input = slaRiskToolInputSchema.parse(rawInput ?? {});
        const payload = await this.dashboardService.getWidget("sla-risk", input.limit ?? 5, {
          organizationId: actor.organizationId
        });
        return { items: payload.widget === "sla-risk" ? payload.items : [] };
      }
      case "get_dispatch_candidates": {
        const input = dispatchCandidatesToolInputSchema.parse(rawInput);
        const workOrder = await this.workOrdersService.list({
          limit: 1,
          offset: 0,
          organizationId: actor.organizationId,
          search: input.workOrderNumber
        });
        const match = workOrder.items[0];

        if (!match) {
          throw new NotFoundException(`Ordem de serviço ${input.workOrderNumber} não encontrada.`);
        }

        const candidates = await this.dispatchService.getCandidates(match.id, actor.organizationId);
        return { candidates, workOrderId: match.id, workOrderNumber: match.number };
      }
      case "get_technician_utilization": {
        const input = technicianUtilizationToolInputSchema.parse(rawInput ?? {});
        const payload = await this.dashboardService.getWidget("technician-utilization", input.limit ?? 5, {
          organizationId: actor.organizationId
        });
        return {
          items: payload.widget === "technician-utilization" ? payload.items : []
        };
      }
    }
  }

  private buildAndStoreRecommendation(input: {
    readonly actor: AuthenticatedActor;
    readonly question: string;
    readonly title: string;
    readonly summary: string;
    readonly evidence: readonly CopilotToolCallEvidence[];
    readonly suggestedAction: CopilotSuggestedAction | null;
    readonly source: "groq" | "heuristic";
  }): CopilotRecommendation {
    const conversationId = randomUUID();
    const recommendation: CopilotRecommendation = {
      approvedAt: null,
      conversationId,
      createdAt: new Date().toISOString(),
      evidence: input.evidence,
      id: randomUUID(),
      question: input.question,
      requiresApproval: input.suggestedAction !== null,
      source: input.source,
      suggestedAction: input.suggestedAction,
      summary: input.summary,
      title: input.title
    };

    recommendationStore.set(recommendation.id, { organizationId: input.actor.organizationId, recommendation });
    void this.persistConversation(input.actor, conversationId, recommendation);

    return recommendation;
  }

  private async persistConversation(
    actor: AuthenticatedActor,
    conversationId: string,
    recommendation: CopilotRecommendation
  ): Promise<void> {
    if (!this.postgresPool) {
      return;
    }

    try {
      await this.postgresPool.query(
        `insert into ai_conversations (id, organization_id, user_id, title)
         values ($1, $2, $3, $4)`,
        [conversationId, actor.organizationId, actor.id, recommendation.title]
      );

      for (const item of recommendation.evidence) {
        await this.postgresPool.query(
          `insert into ai_tool_calls (organization_id, conversation_id, tool_name, input, output, evidence)
           values ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
          [
            actor.organizationId,
            conversationId,
            item.toolName,
            JSON.stringify(item.input),
            JSON.stringify(item.output),
            JSON.stringify(item.output)
          ]
        );
      }

      await this.postgresPool.query(
        `insert into ai_recommendations
           (id, organization_id, conversation_id, user_id, question, title, summary, source, suggested_action, evidence, requires_approval)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)`,
        [
          recommendation.id,
          actor.organizationId,
          conversationId,
          actor.id,
          recommendation.question,
          recommendation.title,
          recommendation.summary,
          recommendation.source,
          recommendation.suggestedAction ? JSON.stringify(recommendation.suggestedAction) : null,
          JSON.stringify(recommendation.evidence),
          recommendation.requiresApproval
        ]
      );
    } catch {
      // Persistência de conversa/evidência/recomendação é best-effort; a recomendação já foi calculada.
    }
  }

  private async persistApproval(actor: AuthenticatedActor, recommendationId: string, approvedAt: string): Promise<void> {
    if (!this.postgresPool) {
      return;
    }

    try {
      await this.postgresPool.query(
        `update ai_recommendations set approved_at = $1 where id = $2 and organization_id = $3`,
        [approvedAt, recommendationId, actor.organizationId]
      );
    } catch {
      // Best-effort: a aprovação já foi aplicada em memória e no despacho.
    }
  }

  private async recordApprovalAudit(actor: AuthenticatedActor, recommendation: CopilotRecommendation): Promise<void> {
    if (!this.postgresPool || !recommendation.suggestedAction) {
      return;
    }

    try {
      await this.postgresPool.query(
        `insert into audit_logs (organization_id, actor_user_id, action, resource_type, resource_id, after, metadata)
         values ($1, $2, 'assign', 'work_order', $3, $4::jsonb, $5::jsonb)`,
        [
          actor.organizationId,
          actor.id,
          recommendation.suggestedAction.workOrderId,
          JSON.stringify({ technicianId: recommendation.suggestedAction.technicianId }),
          JSON.stringify({
            aiRecommendationId: recommendation.id,
            aiTitle: recommendation.title,
            approvedBy: actor.id,
            source: "ai-copilot"
          })
        ]
      );
    } catch {
      // Auditoria suplementar da aprovação de IA é best-effort.
    }
  }
}

function isCopilotToolName(value: string): value is CopilotToolName {
  return (copilotToolNames as readonly string[]).includes(value);
}

function toRecommendation(row: RecommendationRow): CopilotRecommendation {
  return {
    approvedAt: row.approved_at ? toIso(row.approved_at) : null,
    conversationId: row.conversation_id,
    createdAt: toIso(row.created_at),
    evidence: row.evidence,
    id: row.id,
    question: row.question,
    requiresApproval: row.requires_approval,
    source: row.source,
    suggestedAction: row.suggested_action,
    summary: row.summary,
    title: row.title
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
