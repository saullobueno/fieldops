"use client";

import type { MapOverview } from "@fieldops/types";
import { AppShell, Button, EmptyState, ErrorState, LoadingState } from "@fieldops/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { apiFetch } from "../../lib/api-client";
import { MapView, type MapMarker } from "../../lib/map-view";
import { RealtimeStatusBadge } from "../../lib/realtime-status-badge";
import { useRealtimeStream } from "../../lib/use-realtime-stream";
import { useRequireAuth } from "../../lib/use-require-auth";

const technicianStatusLabels: Record<string, string> = {
  assigned: "Atribuído",
  available: "Disponível",
  en_route: "A caminho",
  offline: "Offline",
  on_site: "No local",
  unavailable: "Indisponível"
};

const workOrderStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  en_route: "A caminho",
  on_site: "No local",
  paused: "Pausada",
  requires_review: "Requer revisão",
  scheduled: "Agendada"
};

export default function MapPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const queryClient = useQueryClient();
  const { events, status } = useRealtimeStream(session?.organizationId ?? "", "work_order:read");
  const overviewQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchMapOverview,
    queryKey: ["map-overview"]
  });

  useEffect(() => {
    if (events.length === 0) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["map-overview"] });
  }, [events, queryClient]);

  const markers = useMemo<readonly MapMarker[]>(
    () => (overviewQuery.data ? buildMapMarkers(overviewQuery.data) : []),
    [overviewQuery.data]
  );

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/mapa"
      headerAction={
        <div className="flex items-center gap-2">
          <RealtimeStatusBadge status={status} />
          <Button onClick={() => void overviewQuery.refetch()} variant="secondary">Atualizar</Button>
        </div>
      }
      headerEyebrow="Operação"
      headerTitle="Mapa"
      onLogout={() => void logout()}
      userLabel={session.userName}
    >
      <div className="grid flex-1 gap-5 p-6 xl:grid-cols-[1fr_320px] max-sm:p-4">
        <section className="min-h-[420px] overflow-hidden rounded-lg border border-border bg-card">
          {overviewQuery.isLoading ? (
            <div className="p-4">
              <LoadingState message="Carregando mapa..." />
            </div>
          ) : overviewQuery.isError ? (
            <div className="p-4">
              <ErrorState message="Não foi possível carregar o mapa." onRetry={() => void overviewQuery.refetch()} />
            </div>
          ) : markers.length === 0 ? (
            <div className="p-4">
              <EmptyState message="Sem coordenadas disponíveis no momento." />
            </div>
          ) : (
            <MapView className="h-full min-h-[420px] w-full" markers={markers} />
          )}
        </section>
        <aside className="flex flex-col gap-4 overflow-y-auto">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Técnicos</h2>
            <p className="mt-1 text-xs text-muted-foreground">{overviewQuery.data?.technicians.length ?? 0} no total</p>
            <ul className="mt-3 space-y-2">
              {(overviewQuery.data?.technicians ?? []).map((technician) => (
                <li className="rounded-md border border-border bg-muted p-2 text-sm" key={technician.id}>
                  <p className="font-medium">{technician.name}</p>
                  <p className="text-xs text-muted-foreground">{technicianStatusLabels[technician.status] ?? technician.status}</p>
                </li>
              ))}
              {overviewQuery.data && overviewQuery.data.technicians.length === 0 ? (
                <EmptyState message="Nenhum técnico cadastrado." />
              ) : null}
            </ul>
          </section>
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Ordens ativas</h2>
            <p className="mt-1 text-xs text-muted-foreground">{overviewQuery.data?.workOrders.length ?? 0} no total</p>
            <ul className="mt-3 space-y-2">
              {(overviewQuery.data?.workOrders ?? []).map((workOrder) => (
                <li className="rounded-md border border-border bg-muted p-2 text-sm" key={workOrder.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{workOrder.number}</p>
                    <span className="text-xs text-muted-foreground">{workOrderStatusLabels[workOrder.status] ?? workOrder.status}</span>
                  </div>
                  <p className="mt-1 text-foreground">{workOrder.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{workOrder.customer}</p>
                </li>
              ))}
              {overviewQuery.data && overviewQuery.data.workOrders.length === 0 ? (
                <EmptyState message="Nenhuma ordem ativa no momento." />
              ) : null}
            </ul>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function buildMapMarkers(overview: MapOverview): readonly MapMarker[] {
  const technicianMarkers = overview.technicians.flatMap((technician): MapMarker[] => {
    if (technician.latitude === null || technician.longitude === null) {
      return [];
    }

    return [
      {
        id: `technician-${technician.id}`,
        label: `Tec ${technician.name.split(" ")[0]}`,
        latitude: technician.latitude,
        longitude: technician.longitude,
        tone: "default"
      }
    ];
  });

  const workOrderMarkers = overview.workOrders.flatMap((workOrder): MapMarker[] => {
    if (workOrder.latitude === null || workOrder.longitude === null) {
      return [];
    }

    return [
      {
        id: `work-order-${workOrder.id}`,
        label: workOrder.number,
        latitude: workOrder.latitude,
        longitude: workOrder.longitude,
        tone: "risk"
      }
    ];
  });

  return [...technicianMarkers, ...workOrderMarkers];
}

async function fetchMapOverview(): Promise<MapOverview> {
  const response = await apiFetch("/maps/overview");

  if (!response.ok) {
    throw new Error("Falha ao carregar o mapa.");
  }

  return response.json() as Promise<MapOverview>;
}
