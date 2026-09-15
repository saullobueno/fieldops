import { describe, expect, it } from "vitest";

import { AdminService } from "./admin.service.js";

describe("AdminService", () => {
  it("retorna resumo demo de catálogos administrativos", async () => {
    const service = new AdminService();

    const summary = await service.getCatalogSummary("00000000-0000-4000-8000-000000000001");

    expect(summary.metrics.map((item) => item.resource)).toContain("customers");
    expect(summary.organizationId).toBe("00000000-0000-4000-8000-000000000001");
  });
});
