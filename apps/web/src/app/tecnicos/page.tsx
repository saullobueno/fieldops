"use client";

import type { TechnicianListResponse, TechnicianSummary } from "@fieldops/types";
import { AppShell, Button, EmptyState, ErrorState, LoadingState } from "@fieldops/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

const statusLabels: Record<string, string> = {
  assigned: "Atribuído",
  available: "Disponível",
  en_route: "A caminho",
  offline: "Offline",
  on_site: "No local",
  unavailable: "Indisponível"
};

export default function TechniciansPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const listQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchTechnicians,
    queryKey: ["technicians"]
  });

  const filteredItems = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch = normalizedSearch ? item.name.toLowerCase().includes(normalizedSearch) : true;
      const matchesStatus = status ? item.status === status : true;
      return matchesSearch && matchesStatus;
    });
  }, [listQuery.data, search, status]);

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/tecnicos"
      headerEyebrow="Equipe"
      headerTitle="Técnicos"
      onLogout={() => void logout()}
      userLabel={session.userName}
    >
      <div className="flex-1 p-6 max-sm:p-4">
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Buscar técnicos"
              className="h-9 min-w-64 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-ring"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome"
              value={search}
            />
            <select
              aria-label="Filtrar técnicos por status"
              className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-ring"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">Todos os status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Button onClick={() => void listQuery.refetch()} variant="secondary">Atualizar</Button>
          </div>
          <div className="mt-4">
            {listQuery.isLoading ? (
              <LoadingState message="Carregando técnicos..." />
            ) : listQuery.isError ? (
              <ErrorState message="Não foi possível carregar os técnicos." onRetry={() => void listQuery.refetch()} />
            ) : (
              <TechnicianTable items={filteredItems} />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function TechnicianTable({ items }: { items: readonly TechnicianSummary[] }): React.ReactNode {
  if (items.length === 0) {
    return <EmptyState message="Nenhum técnico encontrado com os filtros atuais." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr>
            <th className="pb-2 font-medium">Técnico</th>
            <th className="pb-2 font-medium">Status</th>
            <th className="pb-2 font-medium">Habilidades</th>
            <th className="pb-2 font-medium">Equipe</th>
            <th className="pb-2 font-medium">Território</th>
            <th className="pb-2 font-medium">Atribuições ativas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr className="hover:bg-background" key={item.id}>
              <td className="py-3">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.email}</p>
              </td>
              <td className="py-3">{statusLabels[item.status] ?? item.status}</td>
              <td className="py-3">{item.skills.length > 0 ? item.skills.join(", ") : "--"}</td>
              <td className="py-3">{item.teamName ?? "--"}</td>
              <td className="py-3">{item.territoryName ?? "--"}</td>
              <td className="py-3">{item.activeAssignmentsCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function fetchTechnicians(): Promise<TechnicianListResponse> {
  const response = await apiFetch("/technicians");

  if (!response.ok) {
    throw new Error("Falha ao carregar técnicos.");
  }

  return response.json() as Promise<TechnicianListResponse>;
}
