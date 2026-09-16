import { describe, expect, it } from "vitest";

import { RealtimeService } from "../realtime/realtime.service.js";
import { WorkOrdersService } from "./work-orders.service.js";

function createService(): WorkOrdersService {
  return new WorkOrdersService(new RealtimeService());
}

describe("WorkOrdersService", () => {
  it("lista ordens por organização com limite explícito", async () => {
    const service = createService();

    expect(
      (await service.list({
        limit: 1,
        offset: 0,
        organizationId: "00000000-0000-4000-8000-000000000001"
      })).items
    ).toHaveLength(1);
  });

  it("aplica regra de ciclo de vida ao atualizar status", async () => {
    const service = createService();

    await expect(
      service.updateStatus({
        actorName: "tester",
        actorUserId: "tester",
        id: "00000000-0000-4000-8000-000000000901",
        organizationId: "00000000-0000-4000-8000-000000000001",
        status: "completed"
      })
    ).rejects.toThrow("Transição inválida");
  });

  it("emite URL assinada para anexos no modo demo", async () => {
    const service = createService();

    const detail = await service.getById(
      "00000000-0000-4000-8000-000000000901",
      "00000000-0000-4000-8000-000000000001"
    );

    expect(detail.attachments[0]?.signedUrl).toContain("signature=");
  });

  it("atualiza respostas do checklist no modo demo", async () => {
    const service = createService();

    const detail = await service.updateChecklist({
      actorUserId: "tester",
      answers: {
        foto_painel: true,
        leitura_eletrica: true,
        pressao_entrada: true
      },
      id: "00000000-0000-4000-8000-000000000901",
      organizationId: "00000000-0000-4000-8000-000000000001"
    });

    expect(detail.checklist.every((item) => item.completed)).toBe(true);
  });

  it("adiciona nota operacional no modo demo", async () => {
    const service = createService();

    const detail = await service.addNote({
      actorName: "Marina Costa",
      actorUserId: "00000000-0000-4000-8000-000000000011",
      body: "Peças separadas para a visita.",
      id: "00000000-0000-4000-8000-000000000901",
      organizationId: "00000000-0000-4000-8000-000000000001"
    });

    expect(detail.notes[0]?.body).toBe("Peças separadas para a visita.");
  });

  it("lista trilha de auditoria no modo demo", async () => {
    const service = createService();

    const auditTrail = await service.getAuditTrail(
      "00000000-0000-4000-8000-000000000901",
      "00000000-0000-4000-8000-000000000001"
    );

    expect(auditTrail[0]).toMatchObject({
      resourceId: "00000000-0000-4000-8000-000000000901",
      resourceType: "work_order"
    });
  });

  it("lista apenas as ordens atribuídas ao técnico autenticado", async () => {
    const service = createService();

    const items = await service.listForTechnician(
      "00000000-0000-4000-8000-000000000012",
      "00000000-0000-4000-8000-000000000001"
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.number).toBe("WO-1001");
  });

  it("rejeita atualização de checklist quando falta campo obrigatório", async () => {
    const service = createService();

    await expect(
      service.updateChecklist({
        actorUserId: "tester",
        answers: { foto_painel: true },
        id: "00000000-0000-4000-8000-000000000901",
        organizationId: "00000000-0000-4000-8000-000000000001"
      })
    ).rejects.toThrow("obrigatórios");
  });

  it("rejeita atualização de checklist quando o valor numérico está fora do intervalo permitido", async () => {
    const service = createService();

    await expect(
      service.updateChecklist({
        actorUserId: "tester",
        answers: { foto_painel: true, leitura_eletrica: 999, pressao_entrada: true },
        id: "00000000-0000-4000-8000-000000000901",
        organizationId: "00000000-0000-4000-8000-000000000001"
      })
    ).rejects.toThrow("formato inválido");
  });

  it("adiciona assinatura vinculada a anexo existente da ordem", async () => {
    const service = createService();

    const detail = await service.addSignature({
      actorUserId: "00000000-0000-4000-8000-000000000011",
      attachmentId: "att-1",
      id: "00000000-0000-4000-8000-000000000901",
      organizationId: "00000000-0000-4000-8000-000000000001",
      signerName: "Renata Farias"
    });

    expect(detail.signatures[0]?.signerName).toBe("Renata Farias");
    expect(detail.signatures[0]?.attachmentId).toBe("att-1");
  });

  it("adiciona anexo enviado no modo demo, disponível para vincular a uma assinatura em seguida", async () => {
    const service = createService();

    const detail = await service.addAttachment({
      actorName: "Ana Ribeiro",
      actorUserId: "00000000-0000-4000-8000-000000000012",
      byteSize: 2_048,
      fileName: "foto-vazamento.jpg",
      id: "00000000-0000-4000-8000-000000000901",
      kind: "photo",
      mimeType: "image/jpeg",
      organizationId: "00000000-0000-4000-8000-000000000001",
      storageKey: "work-orders/wo-901/foto-vazamento.jpg"
    });

    expect(detail.attachments[0]).toMatchObject({ fileName: "foto-vazamento.jpg", kind: "photo" });
    expect(detail.attachments[0]?.signedUrl).toContain("signature=");

    const signed = await service.addSignature({
      actorUserId: "00000000-0000-4000-8000-000000000012",
      attachmentId: detail.attachments[0]!.id,
      id: "00000000-0000-4000-8000-000000000901",
      organizationId: "00000000-0000-4000-8000-000000000001",
      signerName: "Cliente Teste"
    });

    expect(signed.signatures[0]?.attachmentId).toBe(detail.attachments[0]!.id);
  });

  it("rejeita assinatura vinculada a anexo que não pertence à ordem", async () => {
    const service = createService();

    await expect(
      service.addSignature({
        actorUserId: "00000000-0000-4000-8000-000000000011",
        attachmentId: "att-inexistente",
        id: "00000000-0000-4000-8000-000000000901",
        organizationId: "00000000-0000-4000-8000-000000000001",
        signerName: "Renata Farias"
      })
    ).rejects.toThrow();
  });

  it("limita trilha de auditoria no modo demo", async () => {
    const service = createService();

    const auditTrail = await service.getAuditTrail(
      "00000000-0000-4000-8000-000000000901",
      "00000000-0000-4000-8000-000000000001",
      { limit: 1 }
    );

    expect(auditTrail).toHaveLength(1);
  });

  it("filtra trilha de auditoria demo por período", async () => {
    const service = createService();

    const auditTrail = await service.getAuditTrail(
      "00000000-0000-4000-8000-000000000901",
      "00000000-0000-4000-8000-000000000001",
      { from: "2026-01-15T00:00:00.000Z", limit: 20, to: "2026-01-15T23:59:59.999Z" }
    );

    expect(auditTrail.length).toBeGreaterThan(0);
  });
});
