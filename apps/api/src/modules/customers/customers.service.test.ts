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

  it("cria um cliente novo no modo demo e ele passa a aparecer na listagem", async () => {
    const service = new CustomersService();

    const created = await service.create({
      externalRef: "CRM-999",
      name: "Cliente Teste Novo",
      notes: null,
      organizationId
    });

    expect(created.name).toBe("Cliente Teste Novo");
    expect(created.sites).toHaveLength(0);
    expect(created.openWorkOrdersCount).toBe(0);

    const listed = await service.list({ limit: 50, offset: 0, organizationId, search: "Cliente Teste Novo" });
    expect(listed.items.some((item) => item.id === created.id)).toBe(true);
  });

  it("atualiza um cliente existente no modo demo sem afetar os demais", async () => {
    const service = new CustomersService();

    const created = await service.create({
      externalRef: null,
      name: "Cliente Para Atualizar",
      notes: null,
      organizationId
    });

    const updated = await service.update({
      externalRef: "CRM-777",
      id: created.id,
      name: "Cliente Atualizado",
      notes: "Nota adicionada na atualização.",
      organizationId
    });

    expect(updated.name).toBe("Cliente Atualizado");
    expect(updated.externalRef).toBe("CRM-777");
    expect(updated.notes).toBe("Nota adicionada na atualização.");
  });

  it("lança erro ao atualizar cliente inexistente", async () => {
    const service = new CustomersService();

    await expect(
      service.update({ externalRef: null, id: "id-inexistente", name: "X", notes: null, organizationId })
    ).rejects.toThrow("não encontrado");
  });
});
