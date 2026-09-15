import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import { Inject, Injectable, Optional } from "@nestjs/common";
import type { RealtimeEnvelope, RealtimeEvent } from "@fieldops/types";
import type { MessageEvent } from "@nestjs/common";
import { Observable } from "rxjs";
import type pg from "pg";

import { POSTGRES_POOL } from "../infrastructure/infrastructure.module.js";

export interface TechnicianLocationUpdate {
  readonly organizationId: string;
  readonly technicianUserId: string;
  readonly latitude: number;
  readonly longitude: number;
}

@Injectable()
export class RealtimeService {
  private readonly emitter = new EventEmitter();

  constructor(@Optional() @Inject(POSTGRES_POOL) private readonly postgresPool?: pg.Pool) {
    this.emitter.setMaxListeners(0);
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

    this.emitter.emit(channelFor(organizationId), envelope);
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

      return () => {
        clearInterval(heartbeat);
        this.emitter.off(channel, handler);
      };
    });
  }
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
