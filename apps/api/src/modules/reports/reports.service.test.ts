import { describe, expect, it } from "vitest";

import { ReportsService } from "./reports.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("ReportsService", () => {
  it("retorna visão demo com KPIs e séries para os gráficos", async () => {
    const service = new ReportsService();

    const overview = await service.getOverview({
      from: "2026-01-01",
      organizationId,
      to: "2026-01-31"
    });

    expect(overview.kpis.totalWorkOrders).toBeGreaterThan(0);
    expect(overview.kpis.slaComplianceRate).toBeGreaterThan(0);
    expect(overview.statusBreakdown.length).toBeGreaterThan(0);
    expect(overview.dailyVolume.length).toBeGreaterThan(0);
    expect(overview.teamCompliance.length).toBeGreaterThan(0);
    expect(overview.technicianUtilization.length).toBeGreaterThan(0);
    expect(overview.from).toBe("2026-01-01");
    expect(overview.to).toBe("2026-01-31");
  });
});
