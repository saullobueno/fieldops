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

  it("filtra clientes demo por contrato ativo", async () => {
    const service = new CustomersService();

    const result = await service.list({ activeContract: true, limit: 20, offset: 0, organizationId });

    expect(result.items.map((item) => item.name)).toEqual(["Hospital Santa Clara"]);
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

  it("cria e atualiza local, contato, contrato e ativo no modo demo", async () => {
    const service = new CustomersService();
    const customer = await service.create({
      externalRef: "CRM-CRUD",
      name: "Cliente CRUD Admin",
      notes: null,
      organizationId
    });

    const withSite = await service.createSite({
      accessInstructions: "Entrada lateral.",
      addressLine1: "Rua Operacional, 10",
      addressLine2: null,
      city: "São Paulo",
      country: "BR",
      customerId: customer.id,
      latitude: -23.55,
      longitude: -46.63,
      name: "Base Técnica",
      organizationId,
      postalCode: "01000-000",
      state: "SP",
      territoryId: null
    });
    const site = withSite.sites[0]!;

    const withUpdatedSite = await service.updateSite({
      ...site,
      addressLine1: "Rua Operacional, 20",
      customerId: customer.id,
      organizationId
    });
    expect(withUpdatedSite.sites[0]?.addressLine1).toBe("Rua Operacional, 20");

    const withContact = await service.createContact({
      customerId: customer.id,
      email: "ops@example.com",
      name: "Paula Operações",
      organizationId,
      phone: null,
      title: "Operações"
    });
    const contact = withContact.contacts[0]!;

    const withUpdatedContact = await service.updateContact({
      ...contact,
      customerId: customer.id,
      phone: "+55 11 90000-0000",
      organizationId
    });
    expect(withUpdatedContact.contacts[0]?.phone).toBe("+55 11 90000-0000");

    const withContract = await service.createContract({
      customerId: customer.id,
      endsOn: null,
      name: "Contrato piloto",
      organizationId,
      startsOn: "2026-02-01"
    });
    const contract = withContract.contracts[0]!;

    const withUpdatedContract = await service.updateContract({
      ...contract,
      customerId: customer.id,
      endsOn: "2026-12-31",
      organizationId
    });
    expect(withUpdatedContract.contracts[0]?.endsOn).toBe("2026-12-31");

    const withAsset = await service.createAsset({
      customerId: customer.id,
      model: "M-100",
      name: "Gerador principal",
      organizationId,
      serialNumber: "GER-001",
      siteId: site.id,
      warrantyExpiresOn: null
    });
    const asset = withAsset.assets[0]!;

    const withUpdatedAsset = await service.updateAsset({
      ...asset,
      customerId: customer.id,
      name: "Gerador principal revisado",
      organizationId
    });
    expect(withUpdatedAsset.assets[0]?.name).toBe("Gerador principal revisado");

    const withoutAsset = await service.deleteAsset({ customerId: customer.id, id: asset.id, organizationId });
    expect(withoutAsset.assets).toHaveLength(0);

    const withoutContract = await service.deleteContract({ customerId: customer.id, id: contract.id, organizationId });
    expect(withoutContract.contracts).toHaveLength(0);

    const withoutContact = await service.deleteContact({ customerId: customer.id, id: contact.id, organizationId });
    expect(withoutContact.contacts).toHaveLength(0);

    const withoutSite = await service.deleteSite({ customerId: customer.id, id: site.id, organizationId });
    expect(withoutSite.sites).toHaveLength(0);

    await expect(service.deleteSite({ customerId: customer.id, id: site.id, organizationId })).rejects.toThrow(
      "não encontrado"
    );
  });
});
