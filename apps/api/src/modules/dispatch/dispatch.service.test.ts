import { describe, expect, it } from "vitest";

import { CalendarService } from "../calendar/calendar.service.js";
import { MapsService } from "../maps/maps.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { DispatchService } from "./dispatch.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";

function createService(): DispatchService {
  return new DispatchService(new RealtimeService(), new MapsService());
}

describe("DispatchService", () => {
  it("retorna o board demo com técnicos e ordem não atribuída", async () => {
    const service = createService();

    const board = await service.getBoard(organizationId, "2026-01-16");

    expect(board.technicians.map((item) => item.name)).toContain("Ana Ribeiro");
    expect(board.unassigned).toHaveLength(1);
    expect(board.unassigned[0]?.number).toBe("WO-1003");
  });

  it("ranqueia candidatos por pontuação para a ordem não atribuída", async () => {
    const service = createService();

    const candidates = await service.getCandidates("demo-work-order-1003", organizationId);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.score).toBeGreaterThanOrEqual(candidates[candidates.length - 1]!.score);
    expect(candidates.every((item) => typeof item.estimatedTravelMinutes === "number")).toBe(true);
  });

  it("marca conflito quando o calendário externo bloqueia a janela do técnico", async () => {
    const calendarService = new CalendarService({
      health: () => Promise.resolve("ok"),
      listBusySlots: ({ technicianId }) => Promise.resolve(
        technicianId === "demo-technician-carla"
          ? [
              {
                endsAt: new Date("2026-01-16T13:30:00.000Z"),
                source: "calendar:test",
                startsAt: new Date("2026-01-16T13:00:00.000Z")
              }
            ]
          : []
      ),
      provider: "test-calendar"
    });
    const service = new DispatchService(new RealtimeService(), new MapsService(), calendarService);

    const candidates = await service.getCandidates("demo-work-order-1003", organizationId);
    const carla = candidates.find((candidate) => candidate.technicianId === "demo-technician-carla");

    expect(carla?.hasConflict).toBe(true);
  });

  it("cria a atribuição demo, publica assignment_created e move a ordem da lista de não atribuídas", async () => {
    const realtimeService = new RealtimeService();
    const service = new DispatchService(realtimeService, new MapsService());
    let publishedCount = 0;
    const subscription = realtimeService.stream(organizationId).subscribe(() => {
      publishedCount += 1;
    });

    const result = await service.createAssignment({
      actorUserId: "00000000-0000-4000-8000-000000000011",
      organizationId,
      technicianId: "demo-technician-carla",
      workOrderId: "demo-work-order-1003"
    });

    subscription.unsubscribe();
    expect(result.technicianId).toBe("demo-technician-carla");
    expect(publishedCount).toBeGreaterThanOrEqual(2);

    const board = await service.getBoard(organizationId, "2026-01-16");
    expect(board.unassigned).toHaveLength(0);
  });
});
