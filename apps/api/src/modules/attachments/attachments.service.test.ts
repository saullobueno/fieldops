import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentsService, signAttachment } from "./attachments.service.js";

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

  it("grava o arquivo no storage local (sem R2 configurado) e retorna chave/tamanho", async () => {
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

describe("AttachmentsService.createAccessTicket (com R2 configurado)", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "fieldops-attachments-r2-test-"));
    vi.stubEnv("ATTACHMENT_STORAGE_ROOT", rootDir);
    vi.stubEnv("R2_ACCOUNT_ID", "test-account");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
    vi.stubEnv("R2_BUCKET_NAME", "test-bucket");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(rootDir, { force: true, recursive: true });
  });

  it("redireciona para uma URL assinada do R2 quando o arquivo não existe localmente", async () => {
    const service = new AttachmentsService();
    const storageKey = "work-orders/wo-9001/foto-nao-local.jpg";
    const expires = Math.floor((Date.now() + 60_000) / 1000).toString();

    const ticket = await service.createAccessTicket({
      expires,
      signature: signAttachment(storageKey, expires),
      storageKey
    });

    expect(ticket.downloadMode).toBe("redirect");
    expect(ticket.remoteUrl?.startsWith("https://")).toBe(true);
    expect(ticket.remoteUrl).toContain("test-bucket");
    expect(ticket.remoteUrl).toContain("foto-nao-local.jpg");
  });
});
