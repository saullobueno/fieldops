"use client";

import { calculateReconnectDelayMs, isRealtimeConnectionStale } from "@fieldops/domain";
import type { RealtimeEnvelope } from "@fieldops/types";
import { useEffect, useRef, useState } from "react";

export type RealtimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "stale";

const STALE_CHECK_INTERVAL_MS = 5_000;
const MAX_RECENT_EVENTS = 20;

export interface UseRealtimeStreamResult {
  readonly status: RealtimeConnectionStatus;
  readonly events: readonly RealtimeEnvelope[];
}

export function useRealtimeStream(organizationId: string, permissionsCsv: string): UseRealtimeStreamResult {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");
  const [events, setEvents] = useState<readonly RealtimeEnvelope[]>([]);
  const lastEventAtRef = useRef<number>(0);

  useEffect(() => {
    let source: EventSource | undefined;
    let attempt = 0;
    let reconnectTimer: number | undefined;

    function connect(): void {
      const params = new URLSearchParams({ organizationId, permissions: permissionsCsv });
      source = new EventSource(`http://localhost:4000/realtime/stream?${params.toString()}`);

      source.onopen = () => {
        attempt = 0;
        lastEventAtRef.current = Date.now();
        setStatus("connected");
      };

      source.onmessage = (message: MessageEvent<string>) => {
        lastEventAtRef.current = Date.now();
        setStatus("connected");

        let payload: unknown;
        try {
          payload = JSON.parse(message.data);
        } catch {
          return;
        }

        if (isRealtimeEnvelope(payload)) {
          setEvents((current) => [payload, ...current].slice(0, MAX_RECENT_EVENTS));
        }
      };

      source.onerror = () => {
        source?.close();
        setStatus("reconnecting");
        const delay = calculateReconnectDelayMs(attempt);
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    }

    connect();

    const staleInterval = window.setInterval(() => {
      setStatus((current) => {
        if (current !== "connected") {
          return current;
        }

        return isRealtimeConnectionStale(lastEventAtRef.current, Date.now()) ? "stale" : current;
      });
    }, STALE_CHECK_INTERVAL_MS);

    return () => {
      source?.close();
      window.clearInterval(staleInterval);
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [organizationId, permissionsCsv]);

  return { events, status };
}

function isRealtimeEnvelope(value: unknown): value is RealtimeEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    "event" in value &&
    typeof (value as { event?: unknown }).event === "object"
  );
}
