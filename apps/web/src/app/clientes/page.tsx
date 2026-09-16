"use client";

import type {
  AssetDetail,
  CustomerAssetSummary,
  CustomerContact,
  CustomerContract,
  CustomerDetail,
  CustomerListResponse,
  CustomerSite,
  CustomerSummary,
  NamedOption
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
  const [territoryId, setTerritoryId] = useState("");
  const [selectedId, setSelectedId] = useState("00000000-0000-4000-8000-000000000301");
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const territoriesQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchCustomerTerritories,
    queryKey: ["customer-territories"]
  });
  const listQuery = useQuery({
    enabled: Boolean(session),
    queryFn: () => fetchCustomers({ limit, search, territoryId }),
    queryKey: ["customers", limit, search, territoryId]
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
            <select
              aria-label="Filtrar clientes por território"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setTerritoryId(event.target.value)}
              value={territoryId}
            >
              <option value="">Todos os territórios</option>
              {(territoriesQuery.data ?? []).map((territory) => (
                <option key={territory.id} value={territory.id}>{territory.name}</option>
              ))}
            </select>
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

interface SiteWritePayload {
  readonly name: string;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly territoryId: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly accessInstructions: string | null;
}

interface ContactWritePayload {
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly title: string | null;
}

interface ContractWritePayload {
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

interface AssetWritePayload {
  readonly name: string;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly siteId: string;
  readonly warrantyExpiresOn: string | null;
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

function SiteForm({
  initial,
  isPending,
  onCancel,
  onSubmit,
  submitLabel
}: {
  initial?: CustomerSite;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: SiteWritePayload) => void;
  submitLabel: string;
}): React.ReactNode {
  const [name, setName] = useState(initial?.name ?? "");
  const [addressLine1, setAddressLine1] = useState(initial?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initial?.addressLine2 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [postalCode, setPostalCode] = useState(initial?.postalCode ?? "");
  const [country, setCountry] = useState(initial?.country ?? "BR");
  const [territoryId, setTerritoryId] = useState(initial?.territoryId ?? "");
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(initial?.longitude?.toString() ?? "");
  const [accessInstructions, setAccessInstructions] = useState(initial?.accessInstructions ?? "");

  return (
    <form
      className="grid gap-2 rounded-md border border-[#D8DEDA] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
          return;
        }

        onSubmit({
          accessInstructions: accessInstructions.trim() || null,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || null,
          city: city.trim(),
          country: country.trim().toUpperCase() || "BR",
          latitude: parseOptionalNumber(latitude),
          longitude: parseOptionalNumber(longitude),
          name: name.trim(),
          postalCode: postalCode.trim(),
          state: state.trim(),
          territoryId: territoryId.trim() || null
        });
      }}
    >
      <input aria-label="Nome do local" className={inputClassName} onChange={(event) => setName(event.target.value)} placeholder="Nome do local" required value={name} />
      <input aria-label="Endereço" className={inputClassName} onChange={(event) => setAddressLine1(event.target.value)} placeholder="Endereço" required value={addressLine1} />
      <input aria-label="Complemento" className={inputClassName} onChange={(event) => setAddressLine2(event.target.value)} placeholder="Complemento (opcional)" value={addressLine2} />
      <div className="grid gap-2 sm:grid-cols-3">
        <input aria-label="Cidade" className={inputClassName} onChange={(event) => setCity(event.target.value)} placeholder="Cidade" required value={city} />
        <input aria-label="Estado" className={inputClassName} onChange={(event) => setState(event.target.value)} placeholder="Estado" required value={state} />
        <input aria-label="CEP" className={inputClassName} onChange={(event) => setPostalCode(event.target.value)} placeholder="CEP" required value={postalCode} />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <input aria-label="País" className={inputClassName} maxLength={2} onChange={(event) => setCountry(event.target.value)} placeholder="País" value={country} />
        <input aria-label="Latitude" className={inputClassName} onChange={(event) => setLatitude(event.target.value)} placeholder="Latitude" type="number" value={latitude} />
        <input aria-label="Longitude" className={inputClassName} onChange={(event) => setLongitude(event.target.value)} placeholder="Longitude" type="number" value={longitude} />
      </div>
      <input aria-label="Território" className={inputClassName} onChange={(event) => setTerritoryId(event.target.value)} placeholder="ID do território (opcional)" value={territoryId} />
      <textarea aria-label="Instruções de acesso" className={textareaClassName} onChange={(event) => setAccessInstructions(event.target.value)} placeholder="Instruções de acesso (opcional)" value={accessInstructions} />
      <FormActions isPending={isPending} onCancel={onCancel} submitLabel={submitLabel} />
    </form>
  );
}

function ContactForm({
  initial,
  isPending,
  onCancel,
  onSubmit,
  submitLabel
}: {
  initial?: CustomerContact;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: ContactWritePayload) => void;
  submitLabel: string;
}): React.ReactNode {
  const [name, setName] = useState(initial?.name ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");

  return (
    <form
      className="grid gap-2 rounded-md border border-[#D8DEDA] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          return;
        }

        onSubmit({
          email: email.trim() || null,
          name: name.trim(),
          phone: phone.trim() || null,
          title: title.trim() || null
        });
      }}
    >
      <input aria-label="Nome do contato" className={inputClassName} onChange={(event) => setName(event.target.value)} placeholder="Nome do contato" required value={name} />
      <input aria-label="Cargo" className={inputClassName} onChange={(event) => setTitle(event.target.value)} placeholder="Cargo (opcional)" value={title} />
      <input aria-label="Email" className={inputClassName} onChange={(event) => setEmail(event.target.value)} placeholder="Email (opcional)" type="email" value={email} />
      <input aria-label="Telefone" className={inputClassName} onChange={(event) => setPhone(event.target.value)} placeholder="Telefone (opcional)" value={phone} />
      <FormActions isPending={isPending} onCancel={onCancel} submitLabel={submitLabel} />
    </form>
  );
}

function ContractForm({
  initial,
  isPending,
  onCancel,
  onSubmit,
  submitLabel
}: {
  initial?: CustomerContract;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: ContractWritePayload) => void;
  submitLabel: string;
}): React.ReactNode {
  const [name, setName] = useState(initial?.name ?? "");
  const [startsOn, setStartsOn] = useState(toDateInputValue(initial?.startsOn) ?? "");
  const [endsOn, setEndsOn] = useState(toDateInputValue(initial?.endsOn) ?? "");

  return (
    <form
      className="grid gap-2 rounded-md border border-[#D8DEDA] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !startsOn) {
          return;
        }

        onSubmit({
          endsOn: endsOn || null,
          name: name.trim(),
          startsOn
        });
      }}
    >
      <input aria-label="Nome do contrato" className={inputClassName} onChange={(event) => setName(event.target.value)} placeholder="Nome do contrato" required value={name} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Início do contrato" className={inputClassName} onChange={(event) => setStartsOn(event.target.value)} required type="date" value={startsOn} />
        <input aria-label="Fim do contrato" className={inputClassName} onChange={(event) => setEndsOn(event.target.value)} type="date" value={endsOn} />
      </div>
      <FormActions isPending={isPending} onCancel={onCancel} submitLabel={submitLabel} />
    </form>
  );
}

function AssetForm({
  initial,
  isPending,
  onCancel,
  onSubmit,
  sites,
  submitLabel
}: {
  initial?: CustomerAssetSummary;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: AssetWritePayload) => void;
  sites: readonly CustomerSite[];
  submitLabel: string;
}): React.ReactNode {
  const [name, setName] = useState(initial?.name ?? "");
  const [model, setModel] = useState(initial?.model ?? "");
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? "");
  const [siteId, setSiteId] = useState(initial?.siteId ?? sites[0]?.id ?? "");
  const [warrantyExpiresOn, setWarrantyExpiresOn] = useState(toDateInputValue(initial?.warrantyExpiresOn) ?? "");

  return (
    <form
      className="grid gap-2 rounded-md border border-[#D8DEDA] bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !siteId) {
          return;
        }

        onSubmit({
          model: model.trim() || null,
          name: name.trim(),
          serialNumber: serialNumber.trim() || null,
          siteId,
          warrantyExpiresOn: warrantyExpiresOn || null
        });
      }}
    >
      <input aria-label="Nome do ativo" className={inputClassName} onChange={(event) => setName(event.target.value)} placeholder="Nome do ativo" required value={name} />
      <select aria-label="Local do ativo" className={inputClassName} onChange={(event) => setSiteId(event.target.value)} required value={siteId}>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>{site.name}</option>
        ))}
      </select>
      <div className="grid gap-2 sm:grid-cols-2">
        <input aria-label="Modelo" className={inputClassName} onChange={(event) => setModel(event.target.value)} placeholder="Modelo (opcional)" value={model} />
        <input aria-label="Número de série" className={inputClassName} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Número de série (opcional)" value={serialNumber} />
      </div>
      <input aria-label="Fim da garantia" className={inputClassName} onChange={(event) => setWarrantyExpiresOn(event.target.value)} type="date" value={warrantyExpiresOn} />
      <FormActions isPending={isPending} onCancel={onCancel} submitLabel={submitLabel} />
    </form>
  );
}

function FormActions({
  isPending,
  onCancel,
  submitLabel
}: {
  isPending: boolean;
  onCancel: () => void;
  submitLabel: string;
}): React.ReactNode {
  return (
    <div className="flex gap-2">
      <Button disabled={isPending} type="submit" variant="primary">
        {isPending ? "Salvando..." : submitLabel}
      </Button>
      <Button onClick={onCancel} type="button" variant="secondary">Cancelar</Button>
    </div>
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
  const [activeForm, setActiveForm] = useState<string | null>(null);
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
  const createSiteMutation = useCustomerEntityMutation(customerId, "site", "create", queryClient, () => setActiveForm(null));
  const updateSiteMutation = useCustomerEntityMutation(customerId, "site", "update", queryClient, () => setActiveForm(null));
  const createContactMutation = useCustomerEntityMutation(customerId, "contact", "create", queryClient, () => setActiveForm(null));
  const updateContactMutation = useCustomerEntityMutation(customerId, "contact", "update", queryClient, () => setActiveForm(null));
  const createContractMutation = useCustomerEntityMutation(customerId, "contract", "create", queryClient, () => setActiveForm(null));
  const updateContractMutation = useCustomerEntityMutation(customerId, "contract", "update", queryClient, () => setActiveForm(null));
  const createAssetMutation = useCustomerEntityMutation(customerId, "asset", "create", queryClient, () => setActiveForm(null));
  const updateAssetMutation = useCustomerEntityMutation(customerId, "asset", "update", queryClient, () => setActiveForm(null));

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
        <DetailSection
          action={<Button onClick={() => setActiveForm(activeForm === "site:new" ? null : "site:new")} variant="secondary">Novo</Button>}
          title="Locais"
        >
          {activeForm === "site:new" ? (
            <SiteForm
              isPending={createSiteMutation.isPending}
              onCancel={() => setActiveForm(null)}
              onSubmit={(input) => createSiteMutation.mutate({ input })}
              submitLabel="Criar local"
            />
          ) : null}
          {detail.sites.length === 0 ? <EmptyState message="Nenhum local cadastrado." /> : detail.sites.map((site) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={site.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{site.name}</p>
                <Button onClick={() => setActiveForm(activeForm === `site:${site.id}` ? null : `site:${site.id}`)} variant="secondary">Editar</Button>
              </div>
              <p className="text-[#66736D]">{site.addressLine1} · {site.city}/{site.state}</p>
              {activeForm === `site:${site.id}` ? (
                <div className="mt-3">
                  <SiteForm
                    initial={site}
                    isPending={updateSiteMutation.isPending}
                    onCancel={() => setActiveForm(null)}
                    onSubmit={(input) => updateSiteMutation.mutate({ id: site.id, input })}
                    submitLabel="Salvar local"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </DetailSection>
        <DetailSection
          action={<Button onClick={() => setActiveForm(activeForm === "contact:new" ? null : "contact:new")} variant="secondary">Novo</Button>}
          title="Contatos"
        >
          {activeForm === "contact:new" ? (
            <ContactForm
              isPending={createContactMutation.isPending}
              onCancel={() => setActiveForm(null)}
              onSubmit={(input) => createContactMutation.mutate({ input })}
              submitLabel="Criar contato"
            />
          ) : null}
          {detail.contacts.length === 0 ? <EmptyState message="Nenhum contato cadastrado." /> : detail.contacts.map((contact) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={contact.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{contact.name}</p>
                <Button onClick={() => setActiveForm(activeForm === `contact:${contact.id}` ? null : `contact:${contact.id}`)} variant="secondary">Editar</Button>
              </div>
              <p className="text-[#66736D]">{contact.title ?? "Sem cargo"} · {contact.email ?? "sem e-mail"} · {contact.phone ?? "sem telefone"}</p>
              {activeForm === `contact:${contact.id}` ? (
                <div className="mt-3">
                  <ContactForm
                    initial={contact}
                    isPending={updateContactMutation.isPending}
                    onCancel={() => setActiveForm(null)}
                    onSubmit={(input) => updateContactMutation.mutate({ id: contact.id, input })}
                    submitLabel="Salvar contato"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </DetailSection>
        <DetailSection
          action={<Button onClick={() => setActiveForm(activeForm === "contract:new" ? null : "contract:new")} variant="secondary">Novo</Button>}
          title="Contratos"
        >
          {activeForm === "contract:new" ? (
            <ContractForm
              isPending={createContractMutation.isPending}
              onCancel={() => setActiveForm(null)}
              onSubmit={(input) => createContractMutation.mutate({ input })}
              submitLabel="Criar contrato"
            />
          ) : null}
          {detail.contracts.length === 0 ? <EmptyState message="Nenhum contrato cadastrado." /> : detail.contracts.map((contract) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={contract.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{contract.name}</p>
                <Button onClick={() => setActiveForm(activeForm === `contract:${contract.id}` ? null : `contract:${contract.id}`)} variant="secondary">Editar</Button>
              </div>
              <p className="text-[#66736D]">{contract.startsOn} até {contract.endsOn ?? "sem término"}</p>
              {activeForm === `contract:${contract.id}` ? (
                <div className="mt-3">
                  <ContractForm
                    initial={contract}
                    isPending={updateContractMutation.isPending}
                    onCancel={() => setActiveForm(null)}
                    onSubmit={(input) => updateContractMutation.mutate({ id: contract.id, input })}
                    submitLabel="Salvar contrato"
                  />
                </div>
              ) : null}
            </div>
          ))}
        </DetailSection>
        <DetailSection
          action={<Button disabled={detail.sites.length === 0} onClick={() => setActiveForm(activeForm === "asset:new" ? null : "asset:new")} variant="secondary">Novo</Button>}
          title="Ativos"
        >
          {activeForm === "asset:new" ? (
            <AssetForm
              isPending={createAssetMutation.isPending}
              onCancel={() => setActiveForm(null)}
              onSubmit={(input) => createAssetMutation.mutate({ input })}
              sites={detail.sites}
              submitLabel="Criar ativo"
            />
          ) : null}
          {detail.assets.length === 0 ? <EmptyState message="Nenhum ativo cadastrado." /> : detail.assets.map((asset) => (
            <div
              className={
                asset.id === assetId
                  ? "rounded-md border border-[#0E5F4B] bg-[#EEF5F1] p-3 text-sm"
                  : "rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm"
              }
              key={asset.id}
            >
              <div className="flex items-center justify-between gap-3">
                <button className="text-left font-medium text-[#0E5F4B] underline-offset-4 hover:underline" onClick={() => onSelectAsset(asset.id)} type="button">
                  {asset.name}
                </button>
                <Button onClick={() => setActiveForm(activeForm === `asset:${asset.id}` ? null : `asset:${asset.id}`)} variant="secondary">Editar</Button>
              </div>
              <p className="text-[#66736D]">{asset.siteName} · {asset.model ?? "sem modelo"} · {asset.serialNumber ?? "sem série"}</p>
              {activeForm === `asset:${asset.id}` ? (
                <div className="mt-3">
                  <AssetForm
                    initial={asset}
                    isPending={updateAssetMutation.isPending}
                    onCancel={() => setActiveForm(null)}
                    onSubmit={(input) => updateAssetMutation.mutate({ id: asset.id, input })}
                    sites={detail.sites}
                    submitLabel="Salvar ativo"
                  />
                </div>
              ) : null}
            </div>
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

function DetailSection({
  action,
  children,
  title
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}): React.ReactNode {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase text-[#66736D]">{title}</h3>
        {action}
      </div>
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

async function fetchCustomers(input: { limit: number; search: string; territoryId: string }): Promise<CustomerListResponse> {
  const params = new URLSearchParams({ limit: String(input.limit), offset: "0" });
  if (input.search) {
    params.set("search", input.search);
  }
  if (input.territoryId) {
    params.set("territoryId", input.territoryId);
  }

  const response = await apiFetch(`/customers?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar clientes.");
  }

  return response.json() as Promise<CustomerListResponse>;
}

async function fetchCustomerTerritories(): Promise<readonly NamedOption[]> {
  const response = await apiFetch("/customers/territories");

  if (!response.ok) {
    throw new Error("Falha ao carregar territórios.");
  }

  return response.json() as Promise<readonly NamedOption[]>;
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

type CustomerEntityKind = "site" | "contact" | "contract" | "asset";
type CustomerEntityOperation = "create" | "update";
type CustomerEntityInput = SiteWritePayload | ContactWritePayload | ContractWritePayload | AssetWritePayload;

function useCustomerEntityMutation(
  customerId: string,
  kind: CustomerEntityKind,
  operation: CustomerEntityOperation,
  queryClient: ReturnType<typeof useQueryClient>,
  onDone: () => void
) {
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CustomerEntityInput }) =>
      saveCustomerEntity(customerId, kind, operation, input, id),
    onSuccess: async () => {
      onDone();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-detail", customerId] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] })
      ]);
    }
  });
}

async function saveCustomerEntity(
  customerId: string,
  kind: CustomerEntityKind,
  operation: CustomerEntityOperation,
  input: CustomerEntityInput,
  id?: string
): Promise<CustomerDetail> {
  const resource = {
    asset: "assets",
    contact: "contacts",
    contract: "contracts",
    site: "sites"
  }[kind];
  const path =
    operation === "create"
      ? `/customers/${customerId}/${resource}`
      : `/customers/${customerId}/${resource}/${id ?? ""}`;

  const response = await apiFetch(path, {
    body: JSON.stringify(input),
    method: operation === "create" ? "POST" : "PATCH"
  });

  if (!response.ok) {
    throw new Error("Falha ao salvar cadastro administrativo.");
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

const inputClassName = "h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]";
const textareaClassName = "min-h-16 resize-y rounded-md border border-[#C7D0CB] bg-white px-3 py-2 text-sm outline-none focus:border-[#0E5F4B]";

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateInputValue(value: string | null | undefined): string | undefined {
  return value ? value.slice(0, 10) : undefined;
}
