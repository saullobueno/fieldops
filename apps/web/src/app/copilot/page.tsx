"use client";

import type { CopilotApprovalResult, CopilotRecommendation } from "@fieldops/types";
import { AppShell, Button, EmptyState } from "@fieldops/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

const suggestedQuestions = [
  "Quais ordens estão em risco de SLA agora?",
  "Quem deveria assumir a ordem mais crítica hoje?",
  "Como está a utilização dos técnicos?"
] as const;

export default function CopilotPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const [question, setQuestion] = useState("");
  const [recommendation, setRecommendation] = useState<CopilotRecommendation | null>(null);
  const queryClient = useQueryClient();

  const askMutation = useMutation({
    mutationFn: (input: string) => askCopilot(input),
    onSuccess: (data) => setRecommendation(data)
  });

  const approveMutation = useMutation({
    mutationFn: (recommendationId: string) => approveRecommendation(recommendationId),
    onSuccess: async (result) => {
      setRecommendation((current) =>
        current && current.id === result.recommendationId
          ? { ...current, approvedAt: new Date().toISOString() }
          : current
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dispatch-board"] }),
        queryClient.invalidateQueries({ queryKey: ["work-orders"] })
      ]);
    }
  });

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/copilot"
      headerEyebrow="Operação"
      headerTitle="Copiloto de IA"
      onLogout={() => void logout()}
      userLabel={session.userName}
    >
      <div className="flex flex-1 flex-col gap-5 p-6 max-sm:p-4">
        <section className="rounded-lg border border-border bg-card p-4">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const trimmed = question.trim();
              if (trimmed) {
                askMutation.mutate(trimmed);
              }
            }}
          >
            <textarea
              className="min-h-20 resize-y rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring"
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Pergunte sobre risco de SLA, despacho ou utilização de técnicos..."
              value={question}
            />
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((item) => (
                <button
                  className="rounded-full border border-input bg-card px-3 py-1 text-xs text-muted-foreground hover:bg-background"
                  key={item}
                  onClick={() => setQuestion(item)}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
            <div>
              <Button disabled={askMutation.isPending || !question.trim()} type="submit" variant="primary">
                {askMutation.isPending ? "Consultando..." : "Perguntar"}
              </Button>
            </div>
            {askMutation.isError ? (
              <p className="text-sm text-destructive">Não foi possível consultar o copiloto.</p>
            ) : null}
          </form>
        </section>

        {recommendation ? (
          <RecommendationPanel
            isApproving={approveMutation.isPending}
            onApprove={() => approveMutation.mutate(recommendation.id)}
            recommendation={recommendation}
          />
        ) : null}
      </div>
    </AppShell>
  );
}

function RecommendationPanel({
  isApproving,
  onApprove,
  recommendation
}: {
  isApproving: boolean;
  onApprove: () => void;
  recommendation: CopilotRecommendation;
}): React.ReactNode {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{recommendation.title}</h2>
        <span className="rounded-full bg-accent px-2 py-1 text-xs font-medium text-muted-foreground">
          {recommendation.source === "groq" ? "Groq" : "Heurística demo"}
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground">{recommendation.summary}</p>

      {recommendation.suggestedAction ? (
        <div className="mt-4 rounded-md border border-input bg-muted p-3">
          <p className="text-sm font-medium">
            Sugestão: reatribuir {recommendation.suggestedAction.workOrderNumber} para{" "}
            {recommendation.suggestedAction.technicianName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{recommendation.suggestedAction.reason}</p>
          {recommendation.approvedAt ? (
            <p className="mt-3 text-sm font-medium text-success">
              Aprovado às {formatHour(recommendation.approvedAt)} — atribuição criada.
            </p>
          ) : (
            <div className="mt-3">
              <Button disabled={isApproving} onClick={onApprove} variant="primary">
                {isApproving ? "Aprovando..." : "Aprovar reatribuição"}
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Nenhuma alteração é feita sem esta aprovação explícita.
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">Esta recomendação não sugere nenhuma alteração de atribuição.</p>
      )}

      <DetailSection title="Evidências consultadas">
        {recommendation.evidence.length === 0 ? (
          <EmptyState message="Nenhuma ferramenta foi consultada." />
        ) : (
          <div className="space-y-2">
            {recommendation.evidence.map((item, index) => (
              <details className="rounded-md border border-border bg-muted p-3 text-sm" key={`${item.toolName}-${index}`}>
                <summary className="cursor-pointer font-medium">{formatToolName(item.toolName)}</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  {JSON.stringify(item.output, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}
      </DetailSection>
    </section>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }): React.ReactNode {
  return (
    <section className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function formatToolName(name: string): string {
  const labels: Record<string, string> = {
    get_dispatch_candidates: "Candidatos de despacho consultados",
    get_sla_risk_work_orders: "Risco de SLA consultado",
    get_technician_utilization: "Utilização de técnicos consultada"
  };

  return labels[name] ?? name;
}

function formatHour(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

async function askCopilot(question: string): Promise<CopilotRecommendation> {
  const response = await apiFetch("/copilot/ask", {
    body: JSON.stringify({ question }),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao consultar o copiloto.");
  }

  return response.json() as Promise<CopilotRecommendation>;
}

async function approveRecommendation(recommendationId: string): Promise<CopilotApprovalResult> {
  const response = await apiFetch(`/copilot/recommendations/${recommendationId}/approve`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao aprovar a recomendação.");
  }

  return response.json() as Promise<CopilotApprovalResult>;
}
