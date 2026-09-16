import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentsService, signAttachment } from "./attachments.service.js";

const TEST_UPSTASH_BLOB_TOKEN = "AgABAAEBYnBo";

describe("AttachmentsService", () => {
  it("valida uma URL assinada ainda vigente", async () => {
    const service = new AttachmentsService();
    const expires = Math.floor((Date.now() + 60_000) / 1000).toString();

    expect(
      await service.createAccessTicket({
        expires,
        signature: signAttachment("demo/foto.jpg", expires),
        storageKey: "demo/foto.jpg"
      })
    ).toMatchObject({
      downloadMode: "signed-url",
      status: "ready",
      storageKey: "demo/foto.jpg"
    });
  });

  it("bloqueia assinatura inválida", async () => {
    const service = new AttachmentsService();
    const expires = Math.floor((Date.now() + 60_000) / 1000).toString();

    await expect(
      service.createAccessTicket({
        expires,
        signature: "00",
        storageKey: "demo/foto.jpg"
      })
    ).rejects.toThrow("Assinatura do anexo inválida");
  });

  it("retorna modo proxy quando arquivo local existe", async () => {
    const service = new AttachmentsService();
    const storageKey = "demo/work-orders/WO-1001/foto-bomba-a.jpg";
    const expires = Math.floor((Date.now() + 60_000) / 1000).toString();

    await expect(
      service.createAccessTicket({
        expires,
        signature: signAttachment(storageKey, expires),
        storageKey
      })
    ).resolves.toMatchObject({
      downloadMode: "storage-proxy",
      fileName: "foto-bomba-a.jpg",
      storageKey
    });
  });

  it("recusa revogar anexo sem banco de dados configurado", async () => {
    const service = new AttachmentsService();

    await expect(
      service.revoke({
        actorUserId: "00000000-0000-4000-8000-000000000011",
        attachmentId: "att-1",
        organizationId: "00000000-0000-4000-8000-000000000001"
      })
    ).rejects.toThrow("banco de dados configurado");
  });
});

describe("AttachmentsService.upload", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "fieldops-attachments-test-"));
    vi.stubEnv("ATTACHMENT_STORAGE_ROOT", rootDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(rootDir, { force: true, recursive: true });
  });

  it("grava o arquivo no storage local (sem Upstash Blob configurado) e retorna chave/tamanho", async () => {
    const service = new AttachmentsService();
    const content = "conteudo-do-anexo";

    const result = await service.upload({
      body: Buffer.from(content),
      fileName: "foto vazamento (1).jpg",
      mimeType: "image/jpeg",
      workOrderId: "wo-9001"
    });

    expect(result.byteSize).toBe(Buffer.byteLength(content));
    expect(result.storageKey.startsWith("work-orders/wo-9001/")).toBe(true);
    expect(result.storageKey.endsWith(".jpg")).toBe(true);

    const written = readFileSync(path.join(rootDir, result.storageKey), "utf8");
    expect(written).toBe(content);
  });

  it("sanitiza o nome do arquivo removendo caracteres fora de [a-zA-Z0-9._-]", async () => {
    const service = new AttachmentsService();

    const result = await service.upload({
      body: Buffer.from("x"),
      fileName: "../../etc/passwd",
      mimeType: "application/pdf",
      workOrderId: "wo-9001"
    });

    expect(result.storageKey).not.toContain("..");
    expect(result.storageKey.startsWith("work-orders/wo-9001/")).toBe(true);
  });
});

describe("AttachmentsService.createAccessTicket (com Upstash Blob configurado)", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "fieldops-attachments-upstash-test-"));
    vi.stubEnv("ATTACHMENT_STORAGE_ROOT", rootDir);
    vi.stubEnv("UPSTASH_BLOB_TOKEN", TEST_UPSTASH_BLOB_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(rootDir, { force: true, recursive: true });
  });

  it("mantém o ticket assinado da API quando a URL remota não pode ser gerada", async () => {
    const service = new AttachmentsService();
    const storageKey = "work-orders/wo-9001/foto-nao-local.jpg";
    const expires = Math.floor((Date.now() + 60_000) / 1000).toString();

    const ticket = await service.createAccessTicket({
      expires,
      signature: signAttachment(storageKey, expires),
      storageKey
    });

    expect(ticket.downloadMode).toBe("signed-url");
    expect(ticket.remoteUrl).toBeUndefined();
  });
});
