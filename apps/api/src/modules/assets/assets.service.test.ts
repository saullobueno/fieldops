import { describe, expect, it } from "vitest";

import { AssetsService } from "./assets.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("AssetsService", () => {
  it("retorna detalhe demo com timeline de manutenção e documentos", async () => {
    const service = new AssetsService();

    const detail = await service.getById("00000000-0000-4000-8000-000000000501", organizationId);

    expect(detail.customerName).toBe("Hospital Santa Clara");
    expect(detail.maintenanceTimeline).toHaveLength(1);
    expect(detail.documents[0]?.fileName).toBe("foto-bomba-a.jpg");
  });

  it("lança erro para ativo inexistente", async () => {
    const service = new AssetsService();

    await expect(service.getById("id-invalido", organizationId)).rejects.toThrow();
  });
});
