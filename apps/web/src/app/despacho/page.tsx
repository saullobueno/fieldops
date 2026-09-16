"use client";

import type {
  DispatchAssignmentCard,
  DispatchBoard,
  DispatchCandidate,
  DispatchTechnicianLane,
  DispatchUnassignedWorkOrder
} from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { DndContext, useDraggable, useDroppable } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { MapView, type MapMarker, type MapRoute } from "../../lib/map-view";
import { RealtimeStatusBadge } from "../../lib/realtime-status-badge";
import { useRealtimeStream } from "../../lib/use-realtime-stream";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function DispatchPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [activeWorkOrderId, setActiveWorkOrderId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(today);
  const [feedback, setFeedback] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const { events, status } = useRealtimeStream(session?.organizationId ?? "", "work_order:read");
  const boardQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => fetchDispatchBoard(date),
    queryKey: ["dispatch-board", date]
  });

  useEffect(() => {
    if (events.length === 0) {
      return;
    }

    void queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
  }, [events, queryClient]);
  const candidatesQuery = useQuery({
    enabled: Boolean(activeWorkOrderId) && Boolean(session),
    queryFn: () => fetchDispatchCandidates(activeWorkOrderId ?? ""),
    queryKey: ["dispatch-candidates", activeWorkOrderId]
  });
  const assignMutation = useMutation({
    mutationFn: (input: { technicianId: string; workOrderId: string }) => createAssignment(input),
    onError: (error: Error) => {
      setFeedback(error.message);
    },
    onSuccess: async () => {
      setFeedback(undefined);
      await queryClient.invalidateQueries({ queryKey: ["dispatch-board"] });
    }
  });

  function handleDragEnd(event: DragEndEvent): void {
    const workOrderId = event.active.id as string;
    const technicianId = event.over?.id as string | undefined;
    setActiveWorkOrderId(undefined);

    if (!technicianId) {
      return;
    }

    assignMutation.mutate({ technicianId, workOrderId });
  }

  function handleDragStart(event: DragStartEvent): void {
    setActiveWorkOrderId(event.active.id as string);
  }

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/despacho"
      onLogout={() => void logout()}
      userLabel={session.userName}
      headerAction={
        <div className="flex items-center gap-2">
          <RealtimeStatusBadge status={status} />
          <input
            aria-label="Selecionar data do despacho"
            className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
          {date !== today ? (
            <Button onClick={() => setDate(today)} variant="secondary">Hoje</Button>
          ) : null}
        </div>
      }
      headerEyebrow="Operação"
      headerTitle={`Despacho de ${formatDateLabel(date)}`}
    >
      <div className="flex flex-1 flex-col gap-4 p-6 max-sm:p-4">
        {feedback ? (
          <div className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] p-3 text-sm text-[#8A1F11]">{feedback}</div>
        ) : null}
        <BoardState onRetry={() => void boardQuery.refetch()} query={boardQuery}>
          {(board) => (
            <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
              <DispatchBoardContent
                activeWorkOrderId={activeWorkOrderId}
                board={board}
                candidateLoading={candidatesQuery.isFetching}
                candidates={candidatesQuery.data ?? []}
              />
            </DndContext>
          )}
        </BoardState>
      </div>
    </AppShell>
  );
}

function DispatchBoardContent({
  activeWorkOrderId,
  board,
  candidateLoading,
  candidates
}: {
  activeWorkOrderId: string | undefined;
  board: DispatchBoard;
  candidateLoading: boolean;
  candidates: readonly DispatchCandidate[];
}): React.ReactNode {
  const markers = useMemo(() => buildDispatchMarkers(board), [board]);
  const routes = useMemo(
    () => buildDispatchRoutes(board, activeWorkOrderId, candidates),
    [board, activeWorkOrderId, candidates]
  );

  return (
    <div className="flex flex-1 flex-col gap-5">
      <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Mapa do despacho</h2>
            <p className="mt-1 text-xs text-[#66736D]">
              Técnicos e ordens pendentes com coordenadas conhecidas.
              {routes.length > 0 ? " Arraste em andamento: linhas mostram a distância até cada técnico." : ""}
            </p>
          </div>
          <p className="text-xs text-[#66736D]">{markers.length} marcador(es)</p>
        </div>
        {markers.length === 0 ? (
          <div className="mt-3">
            <EmptyState message="Sem coordenadas disponíveis para esta data." />
          </div>
        ) : (
          <MapView className="mt-3 h-72 w-full overflow-hidden rounded-lg border border-[#C7D0CB]" markers={markers} routes={routes} />
        )}
      </section>
      <div className="grid flex-1 gap-5 xl:grid-cols-[300px_1fr]">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <h2 className="text-sm font-semibold">Fila de despacho</h2>
          <p className="mt-1 text-xs text-[#66736D]">Arraste uma ordem para a faixa do técnico desejado.</p>
          <div className="mt-4 space-y-3">
            {board.unassigned.length === 0 ? (
              <EmptyState message="Nenhuma ordem pendente de despacho hoje." />
            ) : (
              board.unassigned.map((item) => <UnassignedCard item={item} key={item.id} />)
            )}
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {board.technicians.map((technician) => (
            <TechnicianLane
              candidate={candidates.find((candidate) => candidate.technicianId === technician.id)}
              candidateLoading={candidateLoading}
              key={technician.id}
              technician={technician}
            />
          ))}
        </section>
      </div>
    </div>
  );
}

function UnassignedCard({ item }: { item: DispatchUnassignedWorkOrder }): React.ReactNode {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: item.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      className="cursor-grab rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm shadow-sm active:cursor-grabbing"
      data-testid={`unassigned-card-${item.number}`}
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{item.number}</p>
        <span className="text-xs font-semibold text-[#9A5B00]">{item.priority}</span>
      </div>
      <p className="mt-1 text-[#151A18]">{item.title}</p>
      <p className="mt-1 text-xs text-[#66736D]">{item.customer}</p>
      <p className="mt-2 font-mono text-xs text-[#66736D]">
        {formatHour(item.scheduledStartAt)} – {formatHour(item.scheduledEndAt)} · SLA {formatHour(item.slaDueAt)}
      </p>
      {item.requiredSkills.length > 0 ? (
        <p className="mt-1 text-xs text-[#66736D]">Habilidades: {item.requiredSkills.join(", ")}</p>
      ) : null}
    </div>
  );
}

function TechnicianLane({
  candidate,
  candidateLoading,
  technician
}: {
  candidate: DispatchCandidate | undefined;
  candidateLoading: boolean;
  technician: DispatchTechnicianLane;
}): React.ReactNode {
  const { isOver, setNodeRef } = useDroppable({ id: technician.id });

  return (
    <section
      className={
        isOver
          ? "rounded-lg border-2 border-dashed border-[#0E5F4B] bg-[#EEF5F1] p-4"
          : "rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4"
      }
      data-testid={`technician-lane-${technician.name}`}
      ref={setNodeRef}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{technician.name}</h3>
        <span className="text-xs text-[#66736D]">{formatTechnicianStatus(technician.status)}</span>
      </div>
      {candidate || candidateLoading ? (
        <div className="mt-3 rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-xs">
          {candidate ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#0E5F4B]">{candidate.score} pts</span>
                <span className={candidate.hasConflict ? "text-[#B42318]" : "text-[#66736D]"}>
                  {candidate.hasConflict ? "Conflito" : "Disponível"}
                </span>
              </div>
              <p className="mt-1 text-[#66736D]">
                Deslocamento: {candidate.estimatedTravelMinutes ?? "--"} min
              </p>
            </>
          ) : (
            <span className="text-[#66736D]">Calculando candidato...</span>
          )}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-[#66736D]">{technician.skills.join(", ") || "Sem habilidades cadastradas"}</p>
      <div className="mt-3 space-y-2">
        {technician.assignments.length === 0 ? (
          <EmptyState message="Sem ordens atribuídas." />
        ) : (
          technician.assignments.map((assignment) => <AssignmentCard assignment={assignment} key={assignment.id} />)
        )}
      </div>
    </section>
  );
}

function AssignmentCard({ assignment }: { assignment: DispatchAssignmentCard }): React.ReactNode {
  return (
    <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm">
      <p className="font-medium">{assignment.workOrderNumber} · {assignment.title}</p>
      <p className="text-xs text-[#66736D]">{assignment.customer}</p>
      <p className="mt-1 font-mono text-xs text-[#66736D]">
        {formatHour(assignment.startsAt)} – {formatHour(assignment.endsAt)}
      </p>
    </div>
  );
}

function BoardState({
  children,
  onRetry,
  query
}: {
  children: (data: DispatchBoard) => React.ReactNode;
  onRetry: () => void;
  query: ReturnType<typeof useQuery<DispatchBoard, Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <LoadingState message="Carregando painel de despacho..." />;
  }

  if (query.isError) {
    return <ErrorState message="Não foi possível carregar o despacho." onRetry={onRetry} />;
  }

  if (!query.data) {
    return <EmptyState message="Nenhum dado disponível." />;
  }

  return children(query.data);
}

function LoadingState({ message }: { message: string }): React.ReactNode {
  return <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">{message}</div>;
}

function EmptyState({ message }: { message: string }): React.ReactNode {
  return <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]">{message}</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactNode {
  return (
    <div className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] p-4 text-sm text-[#8A1F11]">
      {message}
      <div className="mt-3">
        <Button onClick={onRetry} variant="secondary">Tentar novamente</Button>
      </div>
    </div>
  );
}

function formatHour(value: string): string {
  if (!value) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(value));
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(`${value}T12:00:00.000Z`));
}

function formatTechnicianStatus(status: string): string {
  const labels: Record<string, string> = {
    assigned: "Atribuído",
    available: "Disponível",
    en_route: "A caminho",
    offline: "Offline",
    on_site: "No local",
    unavailable: "Indisponível"
  };

  return labels[status] ?? status;
}

function buildDispatchMarkers(board: DispatchBoard): readonly MapMarker[] {
  const technicianMarkers = board.technicians.flatMap((technician): MapMarker[] => {
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

  const orderMarkers = board.unassigned.flatMap((workOrder): MapMarker[] => {
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

  return [...technicianMarkers, ...orderMarkers];
}

/**
 * Enquanto uma ordem não atribuída está sendo arrastada, desenha uma linha
 * reta (não uma rota real, que exigiria consultar o provedor de mapas por
 * candidato) até a base de cada técnico com pontuação calculada — apoia
 * visualmente a mesma decisão que os cartões de pontuação já mostram.
 */
function buildDispatchRoutes(
  board: DispatchBoard,
  activeWorkOrderId: string | undefined,
  candidates: readonly DispatchCandidate[]
): readonly MapRoute[] {
  if (!activeWorkOrderId) {
    return [];
  }

  const workOrder = board.unassigned.find((item) => item.id === activeWorkOrderId);
  if (!workOrder || workOrder.latitude === null || workOrder.longitude === null) {
    return [];
  }

  return candidates.flatMap((candidate): MapRoute[] => {
    const technician = board.technicians.find((item) => item.id === candidate.technicianId);
    if (!technician || technician.latitude === null || technician.longitude === null) {
      return [];
    }

    return [
      {
        coordinates: [
          [technician.longitude, technician.latitude],
          [workOrder.longitude!, workOrder.latitude!]
        ],
        id: `route-${candidate.technicianId}`
      }
    ];
  });
}

async function fetchDispatchBoard(date: string): Promise<DispatchBoard> {
  const response = await apiFetch(`/dispatch/board?date=${date}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar o painel de despacho.");
  }

  return response.json() as Promise<DispatchBoard>;
}

async function fetchDispatchCandidates(workOrderId: string): Promise<readonly DispatchCandidate[]> {
  const response = await apiFetch(`/dispatch/candidates/${workOrderId}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar candidatos de despacho.");
  }

  return response.json() as Promise<readonly DispatchCandidate[]>;
}

async function createAssignment(input: { technicianId: string; workOrderId: string }): Promise<void> {
  const response = await apiFetch("/dispatch/assignments", {
    body: JSON.stringify(input),
    method: "POST"
  });

  if (response.status === 409) {
    throw new Error("Técnico já possui uma ordem atribuída nesse horário.");
  }

  if (!response.ok) {
    throw new Error("Falha ao atribuir a ordem de serviço.");
  }
}
