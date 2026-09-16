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
  UpstashBlobStorageAdapter,
  type MapsAdapter
} from "./index";

const TEST_UPSTASH_BLOB_TOKEN = "AgABAAEBYnBo";

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
  it("usa o adaptador local quando nenhum token do Upstash Blob é configurado", () => {
    const adapter = createStorageAdapter({ localRootDir: "storage" });
    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
    expect(adapter.provider).toBe("local-disk");
  });

  it("usa o adaptador Upstash Blob quando o token é configurado", () => {
    const adapter = createStorageAdapter({
      localRootDir: "storage",
      upstashBlobToken: TEST_UPSTASH_BLOB_TOKEN
    });
    expect(adapter).toBeInstanceOf(UpstashBlobStorageAdapter);
    expect(adapter.provider).toBe("upstash-blob");
  });

  it("recorre ao adaptador local quando o token do Upstash Blob é inválido", () => {
    const adapter = createStorageAdapter({
      localRootDir: "storage",
      upstashBlobToken: "not-a-valid-upstash-blob-token"
    });

    expect(adapter).toBeInstanceOf(LocalStorageAdapter);
    expect(adapter.provider).toBe("local-disk");
  });
});

describe("UpstashBlobStorageAdapter", () => {
  it("faz upload e gera URL assinada pelo bucket configurado", async () => {
    const calls: Array<{ readonly path: string; readonly contentType?: string; readonly expiresIn?: number }> = [];
    const adapter = new UpstashBlobStorageAdapter(TEST_UPSTASH_BLOB_TOKEN, {
      list: () => Promise.resolve({ blobs: [], cursor: undefined }),
      put: (path, _body, options) => {
        calls.push({ contentType: options.contentType, path });
        return Promise.resolve();
      },
      signedReadUrl: (path, options) => {
        calls.push({ expiresIn: options.expiresIn, path });
        return Promise.resolve({ url: `https://signed.example.com/${path}?expires=${options.expiresIn}` });
      }
    });

    await adapter.upload({
      body: Buffer.from("conteudo"),
      key: "work-orders/wo-9001/foto.jpg",
      mimeType: "image/jpeg"
    });

    await expect(adapter.getDownloadUrl("work-orders/wo-9001/foto.jpg", 300)).resolves.toBe(
      "https://signed.example.com/work-orders/wo-9001/foto.jpg?expires=300"
    );
    expect(calls).toEqual([
      { contentType: "image/jpeg", path: "work-orders/wo-9001/foto.jpg" },
      { expiresIn: 300, path: "work-orders/wo-9001/foto.jpg" }
    ]);
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
