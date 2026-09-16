import type { AuthenticatedActor } from "@fieldops/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardService } from "../dashboard/dashboard.service.js";
import { DispatchService } from "../dispatch/dispatch.service.js";
import { MapsService } from "../maps/maps.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { WorkOrdersService } from "../work-orders/work-orders.service.js";
import { CopilotService } from "./copilot.service.js";

const actor: AuthenticatedActor = {
  id: "00000000-0000-4000-8000-000000000011",
  organizationId: "00000000-0000-4000-8000-000000000001",
  permissions: ["ai:read", "work_order:assign"],
  roleIds: [],
  teamIds: [],
  territoryIds: []
};

function createService(): CopilotService {
  return new CopilotService(
    new DashboardService(),
    new DispatchService(new RealtimeService(), new MapsService()),
    new WorkOrdersService(new RealtimeService())
  );
}

describe("CopilotService", () => {
  beforeEach(() => {
    vi.stubEnv("GROQ_API_KEY", "");
  });

  it("usa o caminho heurístico (sem chave de API) e coleta evidência de risco de SLA", async () => {
    const service = createService();

    const recommendation = await service.ask(actor, "Quais ordens estão em risco de SLA agora?");

    expect(recommendation.source).toBe("heuristic");
    expect(recommendation.evidence[0]?.toolName).toBe("get_sla_risk_work_orders");
    expect(recommendation.question).toBe("Quais ordens estão em risco de SLA agora?");
    expect(typeof recommendation.requiresApproval).toBe("boolean");
    // Datasets demo de dashboard/despacho/ordens estão alinhados (mesma WO-1003
    // não atribuída em todos), então o caminho heurístico consegue sugerir uma
    // reatribuição mesmo em modo 100% demo, sem Postgres.
    expect(recommendation.suggestedAction?.type).toBe("reassign_technician");
  });

  it("rejeita aprovação de recomendação sem ação sugerida", async () => {
    const dashboardService = new DashboardService();
    vi.spyOn(dashboardService, "getWidget").mockImplementation((widget) => {
      if (widget === "sla-risk") {
        return Promise.resolve({
          items: [{ customer: "Cliente Sem Candidato", dueAt: "17:00", risk: "alto", workOrderNumber: "WO-9999" }],
          widget: "sla-risk"
        });
      }

      return Promise.resolve({ items: [], widget: "kpis" });
    });
    const workOrdersService = new WorkOrdersService(new RealtimeService());
    vi.spyOn(workOrdersService, "list").mockResolvedValue({ items: [], limit: 1, offset: 0, total: 0 });

    const service = new CopilotService(
      dashboardService,
      new DispatchService(new RealtimeService(), new MapsService()),
      workOrdersService
    );

    const recommendation = await service.ask(actor, "O que fazer com o SLA em risco?");

    expect(recommendation.suggestedAction).toBeNull();
    await expect(service.approve(actor, recommendation.id)).rejects.toThrow("não possui uma ação");
  });

  it("rejeita aprovação de recomendação inexistente", async () => {
    const service = createService();

    await expect(service.approve(actor, "id-inexistente")).rejects.toThrow("não encontrada");
  });

  it("sugere reatribuição quando a ordem de risco tem candidatos de despacho e aprova com sucesso", async () => {
    const dashboardService = new DashboardService();
    vi.spyOn(dashboardService, "getWidget").mockImplementation((widget) => {
      if (widget === "sla-risk") {
        return Promise.resolve({
          items: [{ customer: "Condomínio Jardim Sul", dueAt: "16:00", risk: "alto", workOrderNumber: "WO-1003" }],
          widget: "sla-risk"
        });
      }

      return Promise.resolve({ items: [], widget: "kpis" });
    });
    const workOrdersService = new WorkOrdersService(new RealtimeService());
    vi.spyOn(workOrdersService, "list").mockResolvedValue({
      items: [
        {
          assignedTechnicianUserId: null,
          customer: "Condomínio Jardim Sul",
          id: "demo-work-order-1003",
          number: "WO-1003",
          organizationId: actor.organizationId,
          priority: "Média",
          scheduledStartAt: "2026-01-16T13:00:00.000Z",
          site: "Condomínio Jardim Sul",
          slaDueAt: "2026-01-16T16:00:00.000Z",
          status: "scheduled",
          teamId: null,
          title: "Vazamento em tubulação",
          technician: null,
          territoryId: "00000000-0000-4000-8000-000000000802"
        }
      ],
      limit: 1,
      offset: 0,
      total: 1
    });

    const service = new CopilotService(
      dashboardService,
      new DispatchService(new RealtimeService(), new MapsService()),
      workOrdersService
    );

    const recommendation = await service.ask(actor, "Quem deveria assumir a ordem mais crítica?");

    expect(recommendation.suggestedAction?.type).toBe("reassign_technician");
    expect(recommendation.requiresApproval).toBe(true);
    expect(recommendation.evidence.map((item) => item.toolName)).toEqual([
      "get_sla_risk_work_orders",
      "get_dispatch_candidates"
    ]);

    const approval = await service.approve(actor, recommendation.id);
    expect(approval.workOrderId).toBe(recommendation.suggestedAction?.workOrderId);

    await expect(service.approve(actor, recommendation.id)).rejects.toThrow("já foi aprovada");
  });
});
