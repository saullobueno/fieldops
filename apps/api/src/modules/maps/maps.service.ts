import { Injectable } from "@nestjs/common";
import { createMapsAdapter, estimateRouteWithFallback, MockMapsAdapter, type MapsAdapter } from "@fieldops/integrations";

export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

@Injectable()
export class MapsService {
  private readonly adapter: MapsAdapter;
  private readonly fallbackAdapter = new MockMapsAdapter();

  constructor() {
    // Lê só a variável que este serviço precisa, em vez de `parseServerEnv`
    // completo: essa validação exige DATABASE_URL/REDIS_URL, que não têm
    // relação com o provedor de mapas e podem estar ausentes quando esta
    // classe é instanciada fora do bootstrap da API (ex.: testes unitários).
    this.adapter = createMapsAdapter(process.env.MAPS_PROVIDER_BASE_URL || undefined);
  }

  async estimateTravelMinutes(origin: Coordinates | null, destination: Coordinates | null): Promise<number | null> {
    if (!origin || !destination) {
      return null;
    }

    try {
      const estimate = await estimateRouteWithFallback(this.adapter, this.fallbackAdapter, { destination, origin });
      return Math.round(estimate.durationSeconds / 60);
    } catch {
      return null;
    }
  }
}
