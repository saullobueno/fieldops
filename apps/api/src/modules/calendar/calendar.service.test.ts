import { describe, expect, it } from "vitest";

import { CalendarService } from "./calendar.service.js";

describe("CalendarService", () => {
  it("retorna lista vazia quando nenhum provider é configurado", async () => {
    const service = new CalendarService();

    await expect(
      service.listBusySlots({
        from: new Date("2026-01-16T08:00:00.000Z"),
        technicianId: "tech-1",
        to: new Date("2026-01-16T18:00:00.000Z")
      })
    ).resolves.toEqual([]);
  });

  it("usa o adapter configurado para listar bloqueios externos", async () => {
    const service = new CalendarService({
      health: () => Promise.resolve("ok"),
      listBusySlots: () => Promise.resolve([
        {
          endsAt: new Date("2026-01-16T13:30:00.000Z"),
          source: "calendar:test",
          startsAt: new Date("2026-01-16T13:00:00.000Z")
        }
      ]),
      provider: "test-calendar"
    });

    await expect(
      service.listBusySlots({
        from: new Date("2026-01-16T13:00:00.000Z"),
        technicianId: "tech-1",
        to: new Date("2026-01-16T14:00:00.000Z")
      })
    ).resolves.toHaveLength(1);
  });
});
