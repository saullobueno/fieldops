import { describe, expect, it } from "vitest";

import { RealtimeService } from "./realtime.service.js";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("RealtimeService", () => {
  it("envia um evento de conexão imediatamente ao assinar o stream", async () => {
    const service = new RealtimeService();
    let subscription: { unsubscribe: () => void } | undefined;

    const first = await new Promise((resolve) => {
      subscription = service.stream(organizationId).subscribe((event) => {
        resolve(event);
      });
    });

    subscription?.unsubscribe();
    expect(first).toMatchObject({ data: { event: { type: "notification_created" } } });
  });

  it("entrega eventos publicados apenas para a organização correspondente", async () => {
    const service = new RealtimeService();
    const received: Array<{ data: { event: { data: { workOrderNumber: string } } } }> = [];

    const subscription = service.stream(organizationId).subscribe((event) => {
      received.push(event as (typeof received)[number]);
    });

    service.publish("00000000-0000-4000-8000-000000000999", {
      data: { fromStatus: "scheduled", toStatus: "en_route", workOrderId: "wo-1", workOrderNumber: "WO-9999" },
      type: "work_order_status_changed"
    });

    service.publish(organizationId, {
      data: { fromStatus: "scheduled", toStatus: "en_route", workOrderId: "wo-2", workOrderNumber: "WO-1001" },
      type: "work_order_status_changed"
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    subscription.unsubscribe();

    const workOrderNumbers = received
      .map((event) => event.data.event?.data?.workOrderNumber)
      .filter((value): value is string => Boolean(value));

    expect(workOrderNumbers).toEqual(["WO-1001"]);
  });
});
