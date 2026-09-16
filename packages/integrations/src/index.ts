import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Bucket, type ListPage } from "@upstash/blob";

export interface IntegrationAdapter {
  readonly provider: string;
  health(): Promise<"ok" | "degraded">;
}

export interface RouteEstimate {
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly provider: string;
}

export interface CalendarBusySlot {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly source: string;
}

export interface MapsAdapter extends IntegrationAdapter {
  estimateRoute(input: {
    readonly origin: { readonly latitude: number; readonly longitude: number };
    readonly destination: { readonly latitude: number; readonly longitude: number };
  }): Promise<RouteEstimate>;
}

export interface CalendarAdapter extends IntegrationAdapter {
  listBusySlots(input: {
    readonly technicianId: string;
    readonly from: Date;
    readonly to: Date;
  }): Promise<readonly CalendarBusySlot[]>;
}

export class MockMapsAdapter implements MapsAdapter {
  readonly provider = "mock-maps";

  health(): Promise<"ok"> {
    return Promise.resolve("ok");
  }

  estimateRoute(input: Parameters<MapsAdapter["estimateRoute"]>[0]): Promise<RouteEstimate> {
    const latitudeDelta = input.origin.latitude - input.destination.latitude;
    const longitudeDelta = input.origin.longitude - input.destination.longitude;
    const distanceMeters = Math.round(
      Math.sqrt(latitudeDelta ** 2 + longitudeDelta ** 2) * 111_000
    );

    return Promise.resolve({
      distanceMeters,
      durationSeconds: Math.max(300, Math.round(distanceMeters / 8)),
      provider: this.provider
    });
  }
}

const OSRM_HEALTH_TIMEOUT_MS = 3_000;
const OSRM_ROUTE_TIMEOUT_MS = 5_000;

/**
 * Fronteira de integração externa real: chama um servidor OSRM (roteamento
 * open-source) por HTTP. Não requer chave de API. O domínio nunca importa
 * esta classe diretamente — só o contrato `MapsAdapter` — então trocar de
 * fornecedor não vaza para quem consome estimativas de rota.
 */
export class HttpMapsAdapter implements MapsAdapter {
  readonly provider = "osrm-http";

  constructor(private readonly baseUrl: string) {}

  async health(): Promise<"ok" | "degraded"> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(OSRM_HEALTH_TIMEOUT_MS)
      });

      return response.ok ? "ok" : "degraded";
    } catch {
      return "degraded";
    }
  }

  async estimateRoute(input: Parameters<MapsAdapter["estimateRoute"]>[0]): Promise<RouteEstimate> {
    const coordinates = `${input.origin.longitude},${input.origin.latitude};${input.destination.longitude},${input.destination.latitude}`;
    const response = await fetch(`${this.baseUrl}/route/v1/driving/${coordinates}?overview=false`, {
      signal: AbortSignal.timeout(OSRM_ROUTE_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`Provedor de rotas respondeu ${response.status}.`);
    }

    const body = (await response.json()) as { routes?: ReadonlyArray<{ distance: number; duration: number }> };
    const route = body.routes?.[0];

    if (!route) {
      throw new Error("Provedor de rotas não retornou nenhuma rota.");
    }

    return {
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      provider: this.provider
    };
  }
}

export function createMapsAdapter(baseUrl: string | undefined): MapsAdapter {
  return baseUrl ? new HttpMapsAdapter(baseUrl) : new MockMapsAdapter();
}

export async function estimateRouteWithFallback(
  adapter: MapsAdapter,
  fallback: MapsAdapter,
  input: Parameters<MapsAdapter["estimateRoute"]>[0]
): Promise<RouteEstimate> {
  try {
    return await adapter.estimateRoute(input);
  } catch {
    return fallback.estimateRoute(input);
  }
}

export interface StorageUploadInput {
  readonly key: string;
  readonly body: Buffer;
  readonly mimeType: string;
}

export interface StorageAdapter extends IntegrationAdapter {
  upload(input: StorageUploadInput): Promise<void>;
  /**
   * Retorna uma URL temporária para baixar o objeto diretamente do provedor
   * remoto (sem fazer proxy pela API), ou `undefined` quando o adaptador não
   * tem conceito de URL remota (ex.: `LocalStorageAdapter`, onde o arquivo é
   * servido via streaming local).
   */
  getDownloadUrl(key: string, expiresInSeconds: number): Promise<string | undefined>;
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly provider = "local-disk";

  constructor(private readonly rootDir: string) {}

  health(): Promise<"ok"> {
    return Promise.resolve("ok");
  }

  async upload(input: StorageUploadInput): Promise<void> {
    const root = path.resolve(this.rootDir);
    const destination = path.resolve(root, input.key);

    if (destination !== root && !destination.startsWith(`${root}${path.sep}`)) {
      throw new Error("Chave de storage fora do diretório raiz.");
    }

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, input.body);
  }

  getDownloadUrl(_key: string, _expiresInSeconds: number): Promise<undefined> {
    return Promise.resolve(undefined);
  }
}

interface UpstashBlobBucket {
  put(path: string, body: Buffer, options: { readonly contentType: string }): Promise<unknown>;
  signedReadUrl(path: string, options: { readonly expiresIn: number }): Promise<{ readonly url: string }>;
  list(options: { readonly limit: number }): Promise<ListPage>;
}

/**
 * Fronteira de integração externa real: grava objetos no Upstash Blob. O
 * domínio nunca importa esta classe diretamente — só o contrato
 * `StorageAdapter` — então trocar de fornecedor de storage não vaza para quem
 * consome upload de anexos.
 */
export class UpstashBlobStorageAdapter implements StorageAdapter {
  readonly provider = "upstash-blob";

  private readonly bucket: UpstashBlobBucket;

  constructor(
    token: string,
    bucket?: UpstashBlobBucket
  ) {
    this.bucket = bucket ?? new Bucket({ enableTelemetry: false, token });
  }

  async health(): Promise<"ok" | "degraded"> {
    try {
      await this.bucket.list({ limit: 1 });
      return "ok";
    } catch {
      return "degraded";
    }
  }

  async upload(input: StorageUploadInput): Promise<void> {
    await this.bucket.put(input.key, input.body, { contentType: input.mimeType });
  }

  async getDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
    const signedUrl = await this.bucket.signedReadUrl(key, { expiresIn: expiresInSeconds });
    return signedUrl.url;
  }
}

export function createStorageAdapter(config: {
  readonly localRootDir: string;
  readonly upstashBlobToken?: string;
}): StorageAdapter {
  if (!config.upstashBlobToken) {
    return new LocalStorageAdapter(config.localRootDir);
  }

  try {
    return new UpstashBlobStorageAdapter(config.upstashBlobToken);
  } catch {
    return new LocalStorageAdapter(config.localRootDir);
  }
}

export class MockCalendarAdapter implements CalendarAdapter {
  readonly provider = "mock-calendar";

  health(): Promise<"ok"> {
    return Promise.resolve("ok");
  }

  listBusySlots(input: Parameters<CalendarAdapter["listBusySlots"]>[0]): Promise<readonly CalendarBusySlot[]> {
    const midpoint = new Date(input.from.getTime() + (input.to.getTime() - input.from.getTime()) / 2);

    return Promise.resolve([
      {
        endsAt: new Date(midpoint.getTime() + 30 * 60_000),
        source: `agenda:${input.technicianId}`,
        startsAt: midpoint
      }
    ]);
  }
}
