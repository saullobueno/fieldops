import { describe, expect, it } from "vitest";

import { MapsService } from "./maps.service.js";

describe("MapsService", () => {
  it("estima o tempo de deslocamento usando o adaptador mock quando não há provedor configurado", async () => {
    const service = new MapsService();

    const minutes = await service.estimateTravelMinutes(
      { latitude: -23.5452, longitude: -46.6339 },
      { latitude: -23.5666, longitude: -46.6934 }
    );

    expect(minutes).not.toBeNull();
    expect(minutes).toBeGreaterThan(0);
  });

  it("retorna null quando origem ou destino estão ausentes", async () => {
    const service = new MapsService();

    await expect(
      service.estimateTravelMinutes(null, { latitude: -23.5666, longitude: -46.6934 })
    ).resolves.toBeNull();
  });
});
