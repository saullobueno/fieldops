"use client";

import type {
  AssetDetail,
  CustomerDetail,
  CustomerListResponse,
  CustomerSummary
} from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiBaseUrl, apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

const pageSize = 20;

export default function CustomersPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(pageSize);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("00000000-0000-4000-8000-000000000301");
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const listQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => fetchCustomers({ limit, search }),
    queryKey: ["customers", limit, search]
  });
  const createMutation = useMutation({
    mutationFn: (input: CustomerWritePayload) => createCustomer(input),
    onSuccess: async (created) => {
      setIsCreating(false);
      setSelectedId(created.id);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    }
  });

  const selectedFromList = useMemo(
    () => listQuery.data?.items.find((item) => item.id === selectedId),
    [listQuery.data?.items, selectedId]
  );

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/clientes"
      headerAction={
        <Button onClick={() => setIsCreating((current) => !current)} variant="primary">
          {isCreating ? "Cancelar" : "Novo cliente"}
        </Button>
      }
      headerEyebrow="Cadastro"
      headerTitle="Clientes, locais e ativos"
      onLogout={logout}
      userLabel={session.userName}
    >
      <div className="grid flex-1 gap-5 p-6 xl:grid-cols-[1fr_420px] max-sm:p-4">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          {isCreating ? (
            <div className="mb-4">
              <CustomerForm
                isPending={createMutation.isPending}
                onCancel={() => setIsCreating(false)}
                onSubmit={(input) => createMutation.mutate(input)}
                submitLabel="Criar cliente"
              />
              {createMutation.isError ? (
                <p className="mt-2 text-sm text-[#B42318]">Não foi possível criar o cliente.</p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <input
              aria-label="Buscar clientes"
              className="h-9 min-w-64 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome do cliente"
              value={search}
            />
            <Button onClick={() => void listQuery.refetch()} variant="secondary">Atualizar</Button>
          </div>
          <div className="mt-4">
            <ListState query={listQuery} onRetry={() => void listQuery.refetch()}>
              {(data) => (
                <CustomerTable
                  items={data.items}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setSelectedAssetId(undefined);
                  }}
                  selectedId={selectedFromList?.id ?? selectedId}
                />
              )}
            </ListState>
            {listQuery.data && listQuery.data.items.length < listQuery.data.total ? (
              <div className="mt-4 flex justify-center">
                <Button
                  disabled={listQuery.isFetching}
                  onClick={() => setLimit((current) => current + pageSize)}
                  variant="secondary"
                >
                  Carregar mais
                </Button>
              </div>
            ) : null}
          </div>
        </section>
        <CustomerDetailPanel
          assetId={selectedAssetId}
          customerId={selectedId}
          onSelectAsset={setSelectedAssetId}
        />
      </div>
    </AppShell>
  );
}

interface CustomerWritePayload {
  readonly name: string;
  readonly externalRef: string | null;
  readonly notes: string | null;
}

function CustomerForm({
  initial,
  isPending,
  onCancel,
  onSubmit,
  submitLabel
}: {
  initial?: CustomerWritePayload;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: CustomerWritePayload) => void;
  submitLabel: string;
}): React.ReactNode {
  const [name, setName] = useState(initial?.name ?? "");
  const [externalRef, setExternalRef] = useState(initial?.externalRef ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <form
      className="flex flex-col gap-2 rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName) {
          return;
        }

        onSubmit({
          externalRef: externalRef.trim() || null,
          name: trimmedName,
          notes: notes.trim() || null
        });
      }}
    >
      <input
        aria-label="Nome do cliente"
        className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
        onChange={(event) => setName(event.target.value)}
        placeholder="Nome do cliente"
        required
        value={name}
      />
      <input
        aria-label="Referência externa"
        className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
        onChange={(event) => setExternalRef(event.target.value)}
        placeholder="Referência externa (opcional)"
        value={externalRef}
      />
      <textarea
        aria-label="Notas"
        className="min-h-16 resize-y rounded-md border border-[#C7D0CB] bg-white px-3 py-2 text-sm outline-none focus:border-[#0E5F4B]"
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Notas (opcional)"
        value={notes}
      />
      <div className="flex gap-2">
        <Button disabled={isPending || !name.trim()} type="submit" variant="primary">
          {isPending ? "Salvando..." : submitLabel}
        </Button>
        <Button onClick={onCancel} type="button" variant="secondary">Cancelar</Button>
      </div>
    </form>
  );
}

function CustomerTable({
  items,
  onSelect,
  selectedId
}: {
  items: readonly CustomerSummary[];
  onSelect: (id: string) => void;
  selectedId: string;
}): React.ReactNode {
  if (items.length === 0) {
    return <EmptyState message="Nenhum cliente encontrado com os filtros atuais." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-[#66736D]">
          <tr>
            <th className="pb-2 font-medium">Cliente</th>
            <th className="pb-2 font-medium">Referência</th>
            <th className="pb-2 font-medium">Locais</th>
            <th className="pb-2 font-medium">Ordens abertas</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E1E6E3]">
          {items.map((item) => (
            <tr
              className={item.id === selectedId ? "bg-[#EEF5F1]" : "hover:bg-[#F4F6F5]"}
              key={item.id}
            >
              <td className="py-3">
                <button
                  className="font-medium text-[#0E5F4B] underline-offset-4 hover:underline"
                  onClick={() => onSelect(item.id)}
                  type="button"
                >
                  {item.name}
                </button>
              </td>
              <td className="py-3 font-mono text-xs">{item.externalRef ?? "--"}</td>
              <td className="py-3">{item.sitesCount}</td>
              <td className="py-3">{item.openWorkOrdersCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerDetailPanel({
  assetId,
  customerId,
  onSelectAsset
}: {
  assetId: string | undefined;
  customerId: string;
  onSelectAsset: (id: string) => void;
}): React.ReactNode {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const detailQuery = useQuery({
    enabled: Boolean(customerId),
    queryFn: () => fetchCustomerDetail(customerId),
    queryKey: ["customer-detail", customerId]
  });
  const updateMutation = useMutation({
    mutationFn: (input: CustomerWritePayload) => updateCustomer(customerId, input),
    onSuccess: async () => {
      setIsEditing(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-detail", customerId] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] })
      ]);
    }
  });

  if (detailQuery.isLoading) {
    return <Panel title="Detalhe"><LoadingState message="Carregando cliente selecionado..." /></Panel>;
  }

  if (detailQuery.isError) {
    return (
      <Panel title="Detalhe">
        <ErrorState message="Não foi possível carregar o cliente." onRetry={() => void detailQuery.refetch()} />
      </Panel>
    );
  }

  if (!detailQuery.data) {
    return <Panel title="Detalhe"><EmptyState message="Selecione um cliente para ver os detalhes." /></Panel>;
  }

  const detail = detailQuery.data;

  if (isEditing) {
    return (
      <Panel title={`Editar ${detail.name}`}>
        <CustomerForm
          initial={{ externalRef: detail.externalRef, name: detail.name, notes: detail.notes }}
          isPending={updateMutation.isPending}
          onCancel={() => setIsEditing(false)}
          onSubmit={(input) => updateMutation.mutate(input)}
          submitLabel="Salvar alterações"
        />
        {updateMutation.isError ? (
          <p className="mt-2 text-sm text-[#B42318]">Não foi possível salvar as alterações.</p>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel
      headerAction={<Button onClick={() => setIsEditing(true)} variant="secondary">Editar</Button>}
      title={detail.name}
    >
      <div className="space-y-5">
        {detail.notes ? <p className="text-sm text-[#66736D]">{detail.notes}</p> : null}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Referência" value={detail.externalRef ?? "--"} />
          <Metric label="Ordens abertas" value={String(detail.openWorkOrdersCount)} />
        </div>
        <DetailSection title="Locais">
          {detail.sites.length === 0 ? <EmptyState message="Nenhum local cadastrado." /> : detail.sites.map((site) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={site.id}>
              <p className="font-medium">{site.name}</p>
              <p className="text-[#66736D]">{site.addressLine1} · {site.city}/{site.state}</p>
            </div>
          ))}
        </DetailSection>
        <DetailSection title="Contatos">
          {detail.contacts.length === 0 ? <EmptyState message="Nenhum contato cadastrado." /> : detail.contacts.map((contact) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={contact.id}>
              <p className="font-medium">{contact.name}</p>
              <p className="text-[#66736D]">{contact.title ?? "Sem cargo"} · {contact.email ?? "sem e-mail"} · {contact.phone ?? "sem telefone"}</p>
            </div>
          ))}
        </DetailSection>
        <DetailSection title="Contratos">
          {detail.contracts.length === 0 ? <EmptyState message="Nenhum contrato cadastrado." /> : detail.contracts.map((contract) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={contract.id}>
              <p className="font-medium">{contract.name}</p>
              <p className="text-[#66736D]">{contract.startsOn} até {contract.endsOn ?? "sem término"}</p>
            </div>
          ))}
        </DetailSection>
        <DetailSection title="Ativos">
          {detail.assets.length === 0 ? <EmptyState message="Nenhum ativo cadastrado." /> : detail.assets.map((asset) => (
            <button
              className={
                asset.id === assetId
                  ? "block w-full rounded-md border border-[#0E5F4B] bg-[#EEF5F1] p-3 text-left text-sm"
                  : "block w-full rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-left text-sm hover:bg-[#F4F6F5]"
              }
              key={asset.id}
              onClick={() => onSelectAsset(asset.id)}
              type="button"
            >
              <p className="font-medium">{asset.name}</p>
              <p className="text-[#66736D]">{asset.siteName} · {asset.model ?? "sem modelo"} · {asset.serialNumber ?? "sem série"}</p>
            </button>
          ))}
        </DetailSection>
        {assetId ? <AssetMaintenancePanel assetId={assetId} /> : null}
      </div>
    </Panel>
  );
}

function AssetMaintenancePanel({ assetId }: { assetId: string }): React.ReactNode {
  const assetQuery = useQuery({
    enabled: Boolean(assetId),
    queryFn: () => fetchAssetDetail(assetId),
    queryKey: ["asset-detail", assetId]
  });

  return (
    <DetailSection title="Manutenção do ativo selecionado">
      {assetQuery.isLoading ? <LoadingState message="Carregando histórico do ativo..." /> : null}
      {assetQuery.isError ? (
        <ErrorState message="Não foi possível carregar o ativo." onRetry={() => void assetQuery.refetch()} />
      ) : null}
      {assetQuery.data ? <AssetMaintenanceContent asset={assetQuery.data} /> : null}
    </DetailSection>
  );
}

function AssetMaintenanceContent({ asset }: { asset: AssetDetail }): React.ReactNode {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-[#66736D]">Linha do tempo</h4>
        {asset.maintenanceTimeline.length === 0 ? (
          <EmptyState message="Nenhum evento de manutenção registrado." />
        ) : (
          <div className="space-y-2">
            {asset.maintenanceTimeline.map((item) => (
              <div className="border-l-2 border-[#C7D0CB] pl-3 text-sm" key={item.id}>
                <p className="font-medium">{item.title} · {item.workOrderNumber}</p>
                <p className="text-[#66736D]">{item.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase text-[#66736D]">Documentos</h4>
        {asset.documents.length === 0 ? (
          <EmptyState message="Nenhum documento anexado." />
        ) : (
          <div className="space-y-2">
            {asset.documents.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={item.id}>
                <p className="font-medium">{item.fileName}</p>
                {item.signedUrl ? (
                  <a
                    className="rounded-md border border-[#C7D0CB] bg-white px-3 py-2 text-sm font-medium text-[#151A18] hover:bg-[#F4F6F5]"
                    href={`${apiBaseUrl()}${item.signedUrl}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Abrir
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ListState({
  children,
  onRetry,
  query
}: {
  children: (data: CustomerListResponse) => React.ReactNode;
  onRetry: () => void;
  query: ReturnType<typeof useQuery<CustomerListResponse, Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <LoadingState message="Carregando clientes..." />;
  }

  if (query.isError) {
    return <ErrorState message="Não foi possível carregar os clientes." onRetry={onRetry} />;
  }

  if (!query.data) {
    return <EmptyState message="Nenhum dado disponível." />;
  }

  return children(query.data);
}

function Panel({
  children,
  headerAction,
  title
}: {
  children: React.ReactNode;
  headerAction?: React.ReactNode;
  title: string;
}): React.ReactNode {
  return (
    <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {headerAction}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }): React.ReactNode {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase text-[#66736D]">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3">
      <p className="text-xs text-[#66736D]">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
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

async function fetchCustomers(input: { limit: number; search: string }): Promise<CustomerListResponse> {
  const params = new URLSearchParams({ limit: String(input.limit), offset: "0" });
  if (input.search) {
    params.set("search", input.search);
  }

  const response = await apiFetch(`/customers?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar clientes.");
  }

  return response.json() as Promise<CustomerListResponse>;
}

async function fetchCustomerDetail(id: string): Promise<CustomerDetail> {
  const response = await apiFetch(`/customers/${id}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar detalhe do cliente.");
  }

  return response.json() as Promise<CustomerDetail>;
}

async function createCustomer(input: CustomerWritePayload): Promise<CustomerDetail> {
  const response = await apiFetch("/customers", {
    body: JSON.stringify(input),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao criar cliente.");
  }

  return response.json() as Promise<CustomerDetail>;
}

async function updateCustomer(id: string, input: CustomerWritePayload): Promise<CustomerDetail> {
  const response = await apiFetch(`/customers/${id}`, {
    body: JSON.stringify(input),
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error("Falha ao atualizar cliente.");
  }

  return response.json() as Promise<CustomerDetail>;
}

async function fetchAssetDetail(id: string): Promise<AssetDetail> {
  const response = await apiFetch(`/assets/${id}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar detalhe do ativo.");
  }

  return response.json() as Promise<AssetDetail>;
}
