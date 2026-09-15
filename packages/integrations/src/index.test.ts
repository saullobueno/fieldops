import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createMapsAdapter,
  createStorageAdapter,
  estimateRouteWithFallback,
  HttpMapsAdapter,
  LocalStorageAdapter,
  MockCalendarAdapter,
  MockMapsAdapter,
  R2StorageAdapter,
  type MapsAdapter
} from "./index";

describe("MockMapsAdapter", () => {
  it("gera estimativas determinísticas de rota", async () => {
    const adapter = new MockMapsAdapter();

    await expect(
      adapter.estimateRoute({
        destination: { latitude: -23.5666, longitude: -46.6934 },
        origin: { latitude: -23.5452, longitude: -46.6339 }
      })
    ).resolves.toMatchObject({
      provider: "mock-maps"
    });
  });
});

describe("createMapsAdapter", () => {
  it("usa o adaptador mock quando nenhuma URL de provedor é configurada", () => {
    expect(createMapsAdapter(undefined).provider).toBe("mock-maps");
  });

  it("usa o adaptador HTTP quando uma URL de provedor é configurada", () => {
    const adapter = createMapsAdapter("https://router.example.com");
    expect(adapter).toBeInstanceOf(HttpMapsAdapter);
    expect(adapter.provider).toBe("osrm-http");
  });
});

describe("estimateRouteWithFallback", () => {
  const input = {
    destination: { latitude: -23.5666, longitude: -46.6934 },
    origin: { latitude: -23.5452, longitude: -46.6339 }
  };

  it("usa o adaptador principal quando ele responde com sucesso", async () => {
    const primary: MapsAdapter = {
      estimateRoute: () => Promise.resolve({ distanceMeters: 1_000, durationSeconds: 120, provider: "primary" }),
      health: () => Promise.resolve("ok"),
      provider: "primary"
    };
    const fallback = new MockMapsAdapter();

    const result = await estimateRouteWithFallback(primary, fallback, input);

    expect(result.provider).toBe("primary");
  });

  it("recorre ao fallback quando o adaptador principal falha", async () => {
    const failing: MapsAdapter = {
      estimateRoute: () => Promise.reject(new Error("indisponível")),
      health: () => Promise.resolve("degraded"),
      provider: "failing"
    };
    const fallback = new MockMapsAdapter();

    const result = await estimateRouteWithFallback(failing, fallback, input);

    expect(result.provider).toBe("mock-maps");
  });
});

describe("LocalStorageAdapter", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(path.join(tmpdir(), "fieldops-storage-test-"));
  });

  afterEach(() => {
    rmSync(rootDir, { force: true, recursive: true });
  });

  it("grava o arquivo dentro do diretório raiz, criando subpastas quando necessário", async () => {
    const adapter = new LocalStorageAdapter(rootDir);

    await adapter.upload({
      body: Buffer.from("conteudo-do-anexo"),
      key: "work-orders/WO-9001/foto.jpg",
      mimeType: "image/jpeg"
    });

    const written = readFileSync(path.join(rootDir, "work-orders/WO-9001/foto.jpg"), "utf8");
    expect(written).toBe("conteudo-do-anexo");
  });

  it("rejeita chaves que tentam escapar do diretório raiz (path traversal)", async () => {
    const adapter = new LocalStorageAdapter(rootDir);

    await expect(
      adapter.upload({ body: Buffer.from("x"), key: "../fora-do-root.txt", mimeType: "text/plain" })
    ).rejects.toThrow("fora do diretório raiz");
  });

  it("não tem conceito de URL remota — quem baixa é o streaming local via storage-proxy", async () => {
    const adapter = new LocalStorageAdapter(rootDir);

    await expect(adapter.getDownloadUrl("qualquer-chave.jpg", 300)).resolves.toBeUndefined();
  });
});

describe("createStorageAdapter", () => {
  it("usa o adaptador local quando nenhuma credencial de R2 é configurada", () => {
    const adapter = createStorageAdapter({ localRootDir: "storage" });
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
    expect(adapter.provider).toBe("local-disk");
  });

  it("usa o adaptador R2 quando as credenciais são configuradas", () => {
    const adapter = createStorageAdapter({
      localRootDir: "storage",
      r2: { accessKeyId: "key", accountId: "acc", bucket: "bucket", secretAccessKey: "secret" }
    });
    expect(adapter).toBeInstanceOf(R2StorageAdapter);
    expect(adapter.provider).toBe("cloudflare-r2");
  });
});

describe("MockCalendarAdapter", () => {
  it("gera bloqueios determinísticos por técnico", async () => {
    const adapter = new MockCalendarAdapter();

    await expect(
      adapter.listBusySlots({
        from: new Date("2026-01-15T08:00:00.000Z"),
        technicianId: "tech-1",
        to: new Date("2026-01-15T18:00:00.000Z")
      })
    ).resolves.toHaveLength(1);
  });
});
