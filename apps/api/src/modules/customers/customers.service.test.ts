import { describe, expect, it } from "vitest";

import { CustomersService } from "./customers.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("CustomersService", () => {
  it("lista clientes demo filtrados por organização e busca", async () => {
    const service = new CustomersService();

    const result = await service.list({ limit: 20, offset: 0, organizationId, search: "hospital" });

    expect(result.total).toBe(1);
    expect(result.items[0]?.name).toBe("Hospital Santa Clara");
  });

  it("retorna detalhe demo com locais, contatos e ativos", async () => {
    const service = new CustomersService();

    const detail = await service.getById("00000000-0000-4000-8000-000000000301", organizationId);

    expect(detail.sites).toHaveLength(1);
    expect(detail.assets[0]?.name).toBe("Bomba pressurizadora A");
  });

  it("lança erro para cliente inexistente", async () => {
    const service = new CustomersService();

    await expect(service.getById("id-invalido", organizationId)).rejects.toThrow();
  });
});
