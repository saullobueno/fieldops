import { describe, expect, it } from "vitest";

import { DashboardService } from "./dashboard.service.js";

describe("DashboardService", () => {
  it("respeita limite explícito por widget", async () => {
    const service = new DashboardService();

    expect((await service.getWidget("sla-risk", 2)).items).toHaveLength(2);
  });

  it("retorna payload discriminado por widget", async () => {
    const service = new DashboardService();

    expect(await service.getWidget("kpis", 6)).toMatchObject({
      widget: "kpis"
    });
  });
});
