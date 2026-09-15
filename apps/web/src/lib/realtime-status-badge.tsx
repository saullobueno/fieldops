import type { RealtimeConnectionStatus } from "./use-realtime-stream";

const labels: Record<RealtimeConnectionStatus, string> = {
  connected: "Ao vivo",
  connecting: "Conectando...",
  reconnecting: "Reconectando...",
  stale: "Desatualizado"
};

const toneClass: Record<RealtimeConnectionStatus, string> = {
  connected: "bg-[#E4F3EC] text-[#0E6F4F]",
  connecting: "bg-[#F4F6F5] text-[#66736D]",
  reconnecting: "bg-[#FFF4D6] text-[#8A4B00]",
  stale: "bg-[#FDE8E4] text-[#B42318]"
};

export function RealtimeStatusBadge({ status }: { status: RealtimeConnectionStatus }): React.ReactNode {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass[status]}`}>
      {labels[status]}
    </span>
  );
}
