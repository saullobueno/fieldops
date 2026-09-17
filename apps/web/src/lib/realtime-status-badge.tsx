import type { RealtimeConnectionStatus } from "./use-realtime-stream";

const labels: Record<RealtimeConnectionStatus, string> = {
  connected: "Ao vivo",
  connecting: "Conectando...",
  reconnecting: "Reconectando...",
  stale: "Desatualizado"
};

const toneClass: Record<RealtimeConnectionStatus, string> = {
  connected: "bg-success/10 text-success",
  connecting: "bg-background text-muted-foreground",
  reconnecting: "bg-warning/10 text-warning",
  stale: "bg-destructive/10 text-destructive"
};

export function RealtimeStatusBadge({ status }: { status: RealtimeConnectionStatus }): React.ReactNode {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass[status]}`}>
      {labels[status]}
    </span>
  );
}
