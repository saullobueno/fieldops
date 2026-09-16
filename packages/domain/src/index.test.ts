import { describe, expect, it } from "vitest";

import {
  assertWorkOrderTransition,
  calculateReconnectDelayMs,
  calculateSlaComplianceRate,
  hasScheduleConflict,
  isRealtimeConnectionStale,
  requiresHumanApproval,
  scoreAssignmentCandidate,
  validateChecklistAnswers,
  workOrderLifecyclePolicy
} from "./index";

describe("workOrderLifecyclePolicy", () => {
  it("permite o fluxo operacional principal", () => {
    expect(workOrderLifecyclePolicy.canTransition("draft", "scheduled")).toBe(true);
    expect(workOrderLifecyclePolicy.canTransition("scheduled", "en_route")).toBe(true);
    expect(workOrderLifecyclePolicy.canTransition("en_route", "on_site")).toBe(true);
    expect(workOrderLifecyclePolicy.canTransition("on_site", "completed")).toBe(true);
  });

  it("bloqueia transições depois de cancelamento", () => {
    expect(() => assertWorkOrderTransition("cancelled", "scheduled")).toThrow(
      "Transição inválida"
    );
  });
});

describe("scoreAssignmentCandidate", () => {
  it("pontua no máximo um técnico com todas as habilidades e mesmo território sem carga", () => {
    const result = scoreAssignmentCandidate({
      activeAssignmentCount: 0,
      requiredSkills: ["elétrica", "bombas"],
      technicianSkills: ["elétrica", "bombas", "inspeção"],
      technicianTerritoryId: "territory-1",
      workOrderTerritoryId: "territory-1"
    });

    expect(result.score).toBe(95);
    expect(result.explanation).toHaveLength(3);
  });

  it("penaliza carga de trabalho e falta de habilidades", () => {
    const result = scoreAssignmentCandidate({
      activeAssignmentCount: 5,
      requiredSkills: ["refrigeração"],
      technicianSkills: ["elétrica"],
      technicianTerritoryId: "territory-2",
      workOrderTerritoryId: "territory-1"
    });

    expect(result.score).toBe(10);
  });

  it("penaliza deslocamento estimado acima de 30 minutos", () => {
    const result = scoreAssignmentCandidate({
      activeAssignmentCount: 0,
      requiredSkills: [],
      technicianSkills: [],
      technicianTerritoryId: null,
      travelMinutes: 45,
      workOrderTerritoryId: null
    });

    expect(result.score).toBe(65);
    expect(result.explanation.at(-1)).toContain("Deslocamento estimado de 45 min");
  });

  it("não penaliza deslocamento estimado dentro do limite", () => {
    const result = scoreAssignmentCandidate({
      activeAssignmentCount: 0,
      requiredSkills: [],
      technicianSkills: [],
      technicianTerritoryId: null,
      travelMinutes: 20,
      workOrderTerritoryId: null
    });

    expect(result.score).toBe(75);
  });

  it("nunca retorna pontuação negativa", () => {
    const result = scoreAssignmentCandidate({
      activeAssignmentCount: 20,
      requiredSkills: ["refrigeração"],
      technicianSkills: [],
      technicianTerritoryId: null,
      workOrderTerritoryId: "territory-1"
    });

    expect(result.score).toBe(0);
  });
});

describe("hasScheduleConflict", () => {
  const existing = [
    { endsAt: new Date("2026-01-16T10:00:00.000Z"), startsAt: new Date("2026-01-16T08:00:00.000Z") }
  ];

  it("detecta sobreposição parcial", () => {
    expect(
      hasScheduleConflict(existing, {
        endsAt: new Date("2026-01-16T09:30:00.000Z"),
        startsAt: new Date("2026-01-16T09:00:00.000Z")
      })
    ).toBe(true);
  });

  it("permite janelas adjacentes sem sobreposição", () => {
    expect(
      hasScheduleConflict(existing, {
        endsAt: new Date("2026-01-16T11:00:00.000Z"),
        startsAt: new Date("2026-01-16T10:00:00.000Z")
      })
    ).toBe(false);
  });
});

describe("validateChecklistAnswers", () => {
  const fields = [
    { isRequired: true, key: "pressao_entrada" },
    { isRequired: false, key: "observacoes" },
    { isRequired: true, key: "foto_painel" }
  ];

  it("retorna as chaves obrigatórias sem resposta", () => {
    expect(validateChecklistAnswers(fields, { pressao_entrada: true })).toEqual([
      { key: "foto_painel", reason: "required" }
    ]);
  });

  it("aceita zero e falso como respostas válidas", () => {
    expect(
      validateChecklistAnswers(fields, { foto_painel: "att-1", pressao_entrada: false })
    ).toEqual([]);
  });

  it("não retorna nada quando todos os campos obrigatórios estão preenchidos", () => {
    expect(
      validateChecklistAnswers(fields, { foto_painel: "att-1", pressao_entrada: true })
    ).toEqual([]);
  });

  it("rejeita número fora do intervalo min/max", () => {
    const numericFields = [
      { isRequired: true, key: "leitura", type: "number" as const, validation: { max: 250, min: 0 } }
    ];

    expect(validateChecklistAnswers(numericFields, { leitura: 300 })).toEqual([
      { key: "leitura", reason: "format" }
    ]);
    expect(validateChecklistAnswers(numericFields, { leitura: 120 })).toEqual([]);
  });

  it("rejeita texto que não bate com o padrão regex", () => {
    const patternFields = [
      { isRequired: true, key: "codigo", type: "text" as const, validation: { pattern: "^[A-Z]{3}-\\d{4}$" } }
    ];

    expect(validateChecklistAnswers(patternFields, { codigo: "abc" })).toEqual([
      { key: "codigo", reason: "format" }
    ]);
    expect(validateChecklistAnswers(patternFields, { codigo: "ABC-1234" })).toEqual([]);
  });
});

describe("calculateSlaComplianceRate", () => {
  it("calcula o percentual com uma casa decimal", () => {
    expect(calculateSlaComplianceRate(26, 30)).toBe(86.7);
  });

  it("retorna 0 quando não há ordens mensuráveis", () => {
    expect(calculateSlaComplianceRate(0, 0)).toBe(0);
  });

  it("retorna 100 quando todas as ordens mensuráveis cumpriram o SLA", () => {
    expect(calculateSlaComplianceRate(10, 10)).toBe(100);
  });
});

describe("calculateReconnectDelayMs", () => {
  it("dobra o atraso a cada tentativa", () => {
    expect(calculateReconnectDelayMs(0)).toBe(1_000);
    expect(calculateReconnectDelayMs(1)).toBe(2_000);
    expect(calculateReconnectDelayMs(2)).toBe(4_000);
  });

  it("limita o atraso máximo mesmo com muitas tentativas", () => {
    expect(calculateReconnectDelayMs(10)).toBe(30_000);
  });

  it("trata tentativas negativas como zero", () => {
    expect(calculateReconnectDelayMs(-5)).toBe(1_000);
  });
});

describe("isRealtimeConnectionStale", () => {
  it("considera desatualizado após o limite de tempo sem eventos", () => {
    expect(isRealtimeConnectionStale(0, 46_000)).toBe(true);
  });

  it("considera atualizado dentro do limite de tempo", () => {
    expect(isRealtimeConnectionStale(0, 10_000)).toBe(false);
  });
});

describe("requiresHumanApproval", () => {
  it("exige aprovação para reatribuição de técnico sugerida pela IA", () => {
    expect(requiresHumanApproval("reassign_technician")).toBe(true);
  });
});
