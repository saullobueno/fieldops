import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import { Inject, Injectable, OnModuleDestroy, Optional } from "@nestjs/common";
import type { RedisClient } from "@fieldops/database";
import type { RealtimeEnvelope, RealtimeEvent } from "@fieldops/types";
import type { MessageEvent } from "@nestjs/common";
import { Observable } from "rxjs";
import type pg from "pg";

import { POSTGRES_POOL, REDIS_CLIENT } from "../infrastructure/infrastructure.module.js";

export interface TechnicianLocationUpdate {
  readonly organizationId: string;
  readonly technicianUserId: string;
  readonly latitude: number;
  readonly longitude: number;
}

@Injectable()
export class RealtimeService implements OnModuleDestroy {
  private readonly emitter = new EventEmitter();
  private readonly instanceId = randomUUID();
  private readonly redisSubscriber: RedisClient | undefined;
  private readonly redisSubscriptionCounts = new Map<string, number>();
  private readonly redisMessageHandler = (channel: string, payload: string): void => {
    this.handleRedisMessage(channel, payload);
  };

  constructor(
    @Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool,
    @Optional() @Inject(REDIS_CLIENT) private readonly redisClient?: RedisClient
  ) {
    this.emitter.setMaxListeners(0);
    this.redisSubscriber = redisClient?.duplicate();
    this.redisSubscriber?.on("message", this.redisMessageHandler);
  }

  onModuleDestroy(): void {
    this.redisSubscriber?.off("message", this.redisMessageHandler);
    this.redisSubscriber?.disconnect();
  }

  async recordTechnicianLocation(update: TechnicianLocationUpdate): Promise<void> {
    if (!this.postgresPool) {
      return;
    }

    try {
      await this.postgresPool.query(
        `update technician_profiles
         set current_latitude = $1, current_longitude = $2, location_updated_at = now()
         where user_id = $3 and organization_id = $4`,
        [update.latitude, update.longitude, update.technicianUserId, update.organizationId]
      );
    } catch {
      // Modo demo ou banco indisponível: a localização segue publicada só via SSE.
    }
  }

  publish(organizationId: string, event: RealtimeEvent): void {
    const envelope: RealtimeEnvelope = {
      event,
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      organizationId
    };

    const channel = channelFor(organizationId);
    this.emitter.emit(channel, envelope);

    if (this.redisClient) {
      void this.redisClient.publish(channel, JSON.stringify({ envelope, sourceInstanceId: this.instanceId })).catch(() => {
        // Redis indisponível não deve impedir a entrega local via SSE.
      });
    }
  }

  stream(organizationId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const channel = channelFor(organizationId);
      const handler = (envelope: RealtimeEnvelope): void => {
        subscriber.next(toMessageEvent(envelope));
      };

      subscriber.next(
        toMessageEvent({
          event: { data: { body: "Conectado ao stream de eventos.", title: "Conexão estabelecida" }, type: "notification_created" },
          id: randomUUID(),
          occurredAt: new Date().toISOString(),
          organizationId
        })
      );

      const heartbeat = setInterval(() => {
        subscriber.next({ data: { heartbeat: true } });
      }, 20_000);

      this.emitter.on(channel, handler);
      void this.addRedisSubscription(channel);

      return () => {
        clearInterval(heartbeat);
        this.emitter.off(channel, handler);
        void this.removeRedisSubscription(channel);
      };
    });
  }

  private async addRedisSubscription(channel: string): Promise<void> {
    if (!this.redisSubscriber) {
      return;
    }

    const count = this.redisSubscriptionCounts.get(channel) ?? 0;
    this.redisSubscriptionCounts.set(channel, count + 1);

    if (count > 0) {
      return;
    }

    try {
      await this.redisSubscriber.subscribe(channel);
    } catch {
      this.redisSubscriptionCounts.delete(channel);
    }
  }

  private async removeRedisSubscription(channel: string): Promise<void> {
    if (!this.redisSubscriber) {
      return;
    }

    const count = this.redisSubscriptionCounts.get(channel) ?? 0;
    if (count <= 1) {
      this.redisSubscriptionCounts.delete(channel);
      try {
        await this.redisSubscriber.unsubscribe(channel);
      } catch {
        // A conexão pode já ter sido encerrada no shutdown.
      }
      return;
    }

    this.redisSubscriptionCounts.set(channel, count - 1);
  }

  private handleRedisMessage(channel: string, payload: string): void {
    const parsed = parseRedisRealtimePayload(payload);
    if (!parsed || parsed.sourceInstanceId === this.instanceId) {
      return;
    }

    this.emitter.emit(channel, parsed.envelope);
  }
}

interface RedisRealtimePayload {
  readonly envelope: RealtimeEnvelope;
  readonly sourceInstanceId: string;
}

function parseRedisRealtimePayload(payload: string): RedisRealtimePayload | undefined {
  try {
    const parsed = JSON.parse(payload) as Partial<RedisRealtimePayload>;
    if (
      typeof parsed.sourceInstanceId === "string" &&
      parsed.envelope &&
      typeof parsed.envelope === "object" &&
      "event" in parsed.envelope
    ) {
      return parsed as RedisRealtimePayload;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function channelFor(organizationId: string): string {
  return `org:${organizationId}`;
}

/**
 * O campo `type` do MessageEvent do NestJS vira um nome de evento nomeado no SSE.
 * O EventSource nativo só dispara `onmessage` para eventos SEM nome, então este
 * envelope propositalmente não define `type` — o tipo do evento de domínio viaja
 * dentro de `envelope.event.type`, lido pelo cliente a partir do payload.
 */
function toMessageEvent(envelope: RealtimeEnvelope): MessageEvent {
  return {
    data: envelope,
    id: envelope.id
  };
}
