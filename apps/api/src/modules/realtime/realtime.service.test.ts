import { EventEmitter } from "node:events";

import type { RedisClient } from "@fieldops/database";
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

  it("distribui eventos entre instâncias via Redis sem duplicar o publisher local", async () => {
    const bus = new EventEmitter();
    const firstService = new RealtimeService(undefined, new FakeRedis(bus) as unknown as RedisClient);
    const secondService = new RealtimeService(undefined, new FakeRedis(bus) as unknown as RedisClient);
    const firstReceived: string[] = [];
    const secondReceived: string[] = [];

    const firstSubscription = firstService.stream(organizationId).subscribe((event) => {
      const workOrderNumber = extractWorkOrderNumber(event);
      if (workOrderNumber) {
        firstReceived.push(workOrderNumber);
      }
    });
    const secondSubscription = secondService.stream(organizationId).subscribe((event) => {
      const workOrderNumber = extractWorkOrderNumber(event);
      if (workOrderNumber) {
        secondReceived.push(workOrderNumber);
      }
    });

    firstService.publish(organizationId, {
      data: { fromStatus: "scheduled", toStatus: "en_route", workOrderId: "wo-2", workOrderNumber: "WO-1001" },
      type: "work_order_status_changed"
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    firstSubscription.unsubscribe();
    secondSubscription.unsubscribe();
    firstService.onModuleDestroy();
    secondService.onModuleDestroy();

    expect(firstReceived).toEqual(["WO-1001"]);
    expect(secondReceived).toEqual(["WO-1001"]);
  });
});

function extractWorkOrderNumber(event: unknown): string | undefined {
  const maybeEvent = event as { data?: { event?: { data?: { workOrderNumber?: unknown } } } };
  return typeof maybeEvent.data?.event?.data?.workOrderNumber === "string"
    ? maybeEvent.data.event.data.workOrderNumber
    : undefined;
}

class FakeRedis {
  private readonly subscriptions = new Set<string>();
  private readonly messageHandlers = new Set<(channel: string, payload: string) => void>();
  private readonly busHandler = (channel: string, payload: string): void => {
    if (!this.subscriptions.has(channel)) {
      return;
    }

    for (const handler of this.messageHandlers) {
      handler(channel, payload);
    }
  };

  constructor(private readonly bus: EventEmitter) {
    this.bus.on("message", this.busHandler);
  }

  duplicate(): FakeRedis {
    return new FakeRedis(this.bus);
  }

  on(event: "message", handler: (channel: string, payload: string) => void): this {
    this.messageHandlers.add(handler);
    return this;
  }

  off(event: "message", handler: (channel: string, payload: string) => void): this {
    this.messageHandlers.delete(handler);
    return this;
  }

  async publish(channel: string, payload: string): Promise<number> {
    this.bus.emit("message", channel, payload);
    return this.bus.listenerCount("message");
  }

  async subscribe(channel: string): Promise<number> {
    this.subscriptions.add(channel);
    return this.subscriptions.size;
  }

  async unsubscribe(channel: string): Promise<number> {
    this.subscriptions.delete(channel);
    return this.subscriptions.size;
  }

  disconnect(): void {
    this.bus.off("message", this.busHandler);
    this.messageHandlers.clear();
    this.subscriptions.clear();
  }
}
