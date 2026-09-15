import { describe, expect, it } from "vitest";

import { ChecklistTemplatesService } from "./checklist-templates.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const templateId = "00000000-0000-4000-8000-000000000621";

describe("ChecklistTemplatesService", () => {
  it("lista templates demo com a versão mais recente", async () => {
    const service = new ChecklistTemplatesService();

    const result = await service.list(organizationId);

    expect(result.items[0]?.name).toBe("Checklist de inspeção preventiva");
    expect(result.items[0]?.latestVersion).toBe(1);
  });

  it("retorna detalhe demo com versões e campos", async () => {
    const service = new ChecklistTemplatesService();

    const detail = await service.getById(templateId, organizationId);

    expect(detail.versions[0]?.fields.map((field) => field.key)).toContain("pressao_entrada");
  });

  it("publica uma nova versão incrementando o número", async () => {
    const service = new ChecklistTemplatesService();

    const version = await service.createVersion({
      actorUserId: "00000000-0000-4000-8000-000000000011",
      fields: [
        { isRequired: true, key: "temperatura", label: "Registrar temperatura", type: "number" }
      ],
      organizationId,
      templateId
    });

    expect(version.version).toBeGreaterThanOrEqual(2);
    expect(version.fields[0]?.key).toBe("temperatura");
  });

  it("rejeita nova versão sem campos", async () => {
    const service = new ChecklistTemplatesService();

    await expect(
      service.createVersion({
        actorUserId: "00000000-0000-4000-8000-000000000011",
        fields: [],
        organizationId,
        templateId
      })
    ).rejects.toThrow();
  });

  it("rejeita nova versão para template inexistente", async () => {
    const service = new ChecklistTemplatesService();

    await expect(
      service.createVersion({
        actorUserId: "00000000-0000-4000-8000-000000000011",
        fields: [{ isRequired: false, key: "x", label: "X", type: "text" }],
        organizationId,
        templateId: "id-invalido"
      })
    ).rejects.toThrow();
  });
});
