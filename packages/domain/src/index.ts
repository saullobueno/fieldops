export const FIELDOPS_DOMAIN_VERSION = "0.1.0";

export const workOrderStatuses = [
  "draft",
  "scheduled",
  "en_route",
  "on_site",
  "paused",
  "completed",
  "cancelled",
  "requires_review"
] as const;

export type WorkOrderStatus = (typeof workOrderStatuses)[number];

export const priorities = ["low", "medium", "high", "urgent"] as const;

export type Priority = (typeof priorities)[number];

export interface WorkOrderLifecyclePolicy {
  canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean;
  nextStatuses(from: WorkOrderStatus): readonly WorkOrderStatus[];
}

const transitionMap: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  cancelled: [],
  completed: ["requires_review"],
  draft: ["scheduled", "cancelled"],
  en_route: ["on_site", "paused", "cancelled"],
  on_site: ["paused", "completed", "requires_review", "cancelled"],
  paused: ["scheduled", "en_route", "on_site", "cancelled"],
  requires_review: ["scheduled", "completed", "cancelled"],
  scheduled: ["en_route", "paused", "cancelled"]
};

export const workOrderLifecyclePolicy: WorkOrderLifecyclePolicy = {
  canTransition(from, to) {
    return transitionMap[from].includes(to);
  },
  nextStatuses(from) {
    return transitionMap[from];
  }
};

export function assertWorkOrderTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus
): void {
  if (!workOrderLifecyclePolicy.canTransition(from, to)) {
    throw new Error(`Transição inválida de ordem de serviço: ${from} -> ${to}`);
  }
}

export interface AssignmentCandidateInput {
  readonly technicianSkills: readonly string[];
  readonly requiredSkills: readonly string[];
  readonly technicianTerritoryId: string | null;
  readonly workOrderTerritoryId: string | null;
  readonly activeAssignmentCount: number;
  readonly travelMinutes?: number | null;
}

export interface AssignmentScore {
  readonly score: number;
  readonly explanation: readonly string[];
}

const ASSIGNMENT_BASE_SCORE = 40;
const ASSIGNMENT_SKILL_WEIGHT = 35;
const ASSIGNMENT_TERRITORY_BONUS = 20;
const ASSIGNMENT_WORKLOAD_PENALTY = 6;
const ASSIGNMENT_TRAVEL_PENALTY_THRESHOLD_MINUTES = 30;
const ASSIGNMENT_TRAVEL_PENALTY = 10;

export function scoreAssignmentCandidate(input: AssignmentCandidateInput): AssignmentScore {
  const explanation: string[] = [`Base: ${ASSIGNMENT_BASE_SCORE} pontos.`];
  let score = ASSIGNMENT_BASE_SCORE;

  if (input.requiredSkills.length === 0) {
    score += ASSIGNMENT_SKILL_WEIGHT;
    explanation.push("Ordem sem habilidades obrigatórias.");
  } else {
    const matched = input.requiredSkills.filter((skill) => input.technicianSkills.includes(skill));
    const ratio = matched.length / input.requiredSkills.length;
    const skillPoints = Math.round(ASSIGNMENT_SKILL_WEIGHT * ratio);
    score += skillPoints;
    explanation.push(
      `Habilidades: ${matched.length}/${input.requiredSkills.length} correspondem (+${skillPoints}).`
    );
  }

  if (input.workOrderTerritoryId && input.technicianTerritoryId === input.workOrderTerritoryId) {
    score += ASSIGNMENT_TERRITORY_BONUS;
    explanation.push(`Território coincide (+${ASSIGNMENT_TERRITORY_BONUS}).`);
  } else if (input.workOrderTerritoryId) {
    explanation.push("Território diferente do técnico.");
  }

  const workloadPenalty = Math.min(input.activeAssignmentCount * ASSIGNMENT_WORKLOAD_PENALTY, ASSIGNMENT_BASE_SCORE);
  if (workloadPenalty > 0) {
    score -= workloadPenalty;
    explanation.push(`Carga atual de ${input.activeAssignmentCount} ordens (-${workloadPenalty}).`);
  }

  if (input.travelMinutes != null && input.travelMinutes > ASSIGNMENT_TRAVEL_PENALTY_THRESHOLD_MINUTES) {
    score -= ASSIGNMENT_TRAVEL_PENALTY;
    explanation.push(`Deslocamento estimado de ${Math.round(input.travelMinutes)} min (-${ASSIGNMENT_TRAVEL_PENALTY}).`);
  }

  return {
    explanation,
    score: Math.max(0, Math.min(100, score))
  };
}

export interface TimeWindow {
  readonly startsAt: Date;
  readonly endsAt: Date;
}

export function hasScheduleConflict(
  existingWindows: readonly TimeWindow[],
  candidate: TimeWindow
): boolean {
  return existingWindows.some(
    (window) => candidate.startsAt < window.endsAt && candidate.endsAt > window.startsAt
  );
}

export const checklistFieldTypes = [
  "text",
  "number",
  "select",
  "checkbox",
  "photo",
  "signature",
  "pass_fail"
] as const;

export type ChecklistFieldType = (typeof checklistFieldTypes)[number];

export interface ChecklistFieldRequirement {
  readonly key: string;
  readonly isRequired: boolean;
  readonly type?: ChecklistFieldType;
  readonly validation?: Record<string, unknown>;
}

export interface ChecklistValidationError {
  readonly key: string;
  readonly reason: "required" | "format";
}

export function validateChecklistAnswers(
  fields: readonly ChecklistFieldRequirement[],
  answers: Record<string, unknown>
): readonly ChecklistValidationError[] {
  const errors: ChecklistValidationError[] = [];

  for (const field of fields) {
    const value = answers[field.key];
    const isEmpty = isEmptyChecklistAnswer(value);

    if (field.isRequired && isEmpty) {
      errors.push({ key: field.key, reason: "required" });
      continue;
    }

    if (!isEmpty && !matchesChecklistFieldFormat(field, value)) {
      errors.push({ key: field.key, reason: "format" });
    }
  }

  return errors;
}

function isEmptyChecklistAnswer(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * Só cobre `min`/`max` (campos numéricos) e `pattern` (regex, campos de texto),
 * que é o que `form_fields.validation` já suporta hoje. Outros tipos de campo
 * não têm formato para validar além da presença, já checada acima.
 */
function matchesChecklistFieldFormat(field: ChecklistFieldRequirement, value: unknown): boolean {
  const validation = field.validation;
  if (!validation) {
    return true;
  }

  if (field.type === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isNaN(numeric)) {
      return false;
    }

    const min = typeof validation.min === "number" ? validation.min : undefined;
    const max = typeof validation.max === "number" ? validation.max : undefined;

    return (min === undefined || numeric >= min) && (max === undefined || numeric <= max);
  }

  const pattern = typeof validation.pattern === "string" ? validation.pattern : undefined;
  if (pattern && typeof value === "string") {
    return new RegExp(pattern).test(value);
  }

  return true;
}

export function calculateSlaComplianceRate(compliant: number, measurable: number): number {
  if (measurable <= 0) {
    return 0;
  }

  return Math.round((compliant / measurable) * 1000) / 10;
}

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;

export function calculateReconnectDelayMs(attempt: number): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const delay = RECONNECT_BASE_DELAY_MS * 2 ** safeAttempt;
  return Math.min(delay, RECONNECT_MAX_DELAY_MS);
}

const STALE_CONNECTION_THRESHOLD_MS = 45_000;

export function isRealtimeConnectionStale(lastEventAt: number, now: number): boolean {
  return now - lastEventAt > STALE_CONNECTION_THRESHOLD_MS;
}

/**
 * Ações que o copiloto de IA pode sugerir, mas nunca executar sozinho.
 * Qualquer ação que altere atribuição/agendamento exige aprovação humana
 * explícita antes de chamar o serviço real de domínio (ex.: DispatchService).
 */
export const aiActionsRequiringApproval = ["reassign_technician"] as const;

export type AiActionType = (typeof aiActionsRequiringApproval)[number];

export function requiresHumanApproval(actionType: AiActionType): boolean {
  return aiActionsRequiringApproval.includes(actionType);
}
