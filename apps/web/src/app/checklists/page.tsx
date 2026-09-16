"use client";

import type {
  ChecklistFieldDefinition,
  ChecklistFieldInput,
  ChecklistFieldType,
  ChecklistTemplateDetail,
  ChecklistTemplateListResponse,
  ChecklistTemplateSummary,
  ChecklistVersionSummary
} from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

const fieldTypeOptions: readonly { label: string; value: ChecklistFieldType }[] = [
  { label: "Texto", value: "text" },
  { label: "Número", value: "number" },
  { label: "Seleção", value: "select" },
  { label: "Caixa de seleção", value: "checkbox" },
  { label: "Foto", value: "photo" },
  { label: "Assinatura", value: "signature" },
  { label: "Aprovado/Reprovado", value: "pass_fail" }
];

interface FieldFormRow {
  readonly rowId: string;
  readonly key: string;
  readonly label: string;
  readonly type: ChecklistFieldType;
  readonly isRequired: boolean;
  readonly min: string;
  readonly max: string;
  readonly pattern: string;
}

function emptyFieldRow(): FieldFormRow {
  return { isRequired: false, key: "", label: "", max: "", min: "", pattern: "", rowId: crypto.randomUUID(), type: "text" };
}

function toFieldFormRow(field: ChecklistFieldDefinition): FieldFormRow {
  return {
    isRequired: field.isRequired,
    key: field.key,
    label: field.label,
    max: typeof field.validation.max === "number" ? String(field.validation.max) : "",
    min: typeof field.validation.min === "number" ? String(field.validation.min) : "",
    pattern: typeof field.validation.pattern === "string" ? field.validation.pattern : "",
    rowId: field.id || crypto.randomUUID(),
    type: field.type
  };
}

function toFieldInput(row: FieldFormRow): ChecklistFieldInput {
  const validation: Record<string, unknown> = {};
  if (row.type === "number") {
    if (row.min.trim()) {
      validation.min = Number(row.min);
    }
    if (row.max.trim()) {
      validation.max = Number(row.max);
    }
  } else if (row.type === "text" && row.pattern.trim()) {
    validation.pattern = row.pattern.trim();
  }

  return {
    isRequired: row.isRequired,
    key: row.key.trim(),
    label: row.label.trim(),
    type: row.type,
    validation: Object.keys(validation).length > 0 ? validation : undefined
  };
}

export default function ChecklistTemplatesPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const listQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchChecklistTemplates,
    queryKey: ["checklist-templates"]
  });

  const activeId = selectedId ?? listQuery.data?.items[0]?.id;

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/checklists"
      headerEyebrow="Cadastro"
      headerTitle="Templates de checklist"
      onLogout={() => void logout()}
      userLabel={session.userName}
    >
      <div className="grid flex-1 gap-5 p-6 xl:grid-cols-[320px_1fr] max-sm:p-4">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <h2 className="text-sm font-semibold">Templates</h2>
          <div className="mt-4">
            <TemplateListState onRetry={() => void listQuery.refetch()} query={listQuery}>
              {(data) => (
                <TemplateList items={data.items} onSelect={setSelectedId} selectedId={activeId} />
              )}
            </TemplateListState>
          </div>
        </section>
        {activeId ? <TemplateDetailPanel id={activeId} /> : (
          <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
            <EmptyState message="Selecione um template para ver os campos." />
          </section>
        )}
      </div>
    </AppShell>
  );
}

function TemplateList({
  items,
  onSelect,
  selectedId
}: {
  items: readonly ChecklistTemplateSummary[];
  onSelect: (id: string) => void;
  selectedId: string | undefined;
}): React.ReactNode {
  if (items.length === 0) {
    return <EmptyState message="Nenhum template de checklist cadastrado." />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          className={
            item.id === selectedId
              ? "block w-full rounded-md border border-[#0E5F4B] bg-[#EEF5F1] p-3 text-left text-sm"
              : "block w-full rounded-md border border-[#D8DEDA] bg-white p-3 text-left text-sm hover:bg-[#F4F6F5]"
          }
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          <p className="font-medium">{item.name}</p>
          <p className="mt-1 text-xs text-[#66736D]">
            {item.latestVersion ? `Versão ${item.latestVersion}` : "Sem versão publicada"} · {item.isActive ? "Ativo" : "Inativo"}
          </p>
        </button>
      ))}
    </div>
  );
}

function TemplateDetailPanel({ id }: { id: string }): React.ReactNode {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const detailQuery = useQuery({
    enabled: Boolean(id),
    queryFn: () => fetchChecklistTemplateDetail(id),
    queryKey: ["checklist-template-detail", id]
  });
  const createVersionMutation = useMutation({
    mutationFn: (fields: readonly ChecklistFieldInput[]) => createChecklistVersion(id, fields),
    onSuccess: async () => {
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["checklist-template-detail", id] });
      await queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
    }
  });

  if (detailQuery.isLoading) {
    return <Panel title="Detalhe"><LoadingState message="Carregando template..." /></Panel>;
  }

  if (detailQuery.isError) {
    return (
      <Panel title="Detalhe">
        <ErrorState message="Não foi possível carregar o template." onRetry={() => void detailQuery.refetch()} />
      </Panel>
    );
  }

  if (!detailQuery.data) {
    return <Panel title="Detalhe"><EmptyState message="Template não encontrado." /></Panel>;
  }

  const detail = detailQuery.data;
  const latestVersion = detail.versions[0];

  if (isEditing) {
    return (
      <Panel title={`Editar campos · ${detail.name}`}>
        <ChecklistFieldsForm
          initialFields={latestVersion?.fields ?? []}
          isPending={createVersionMutation.isPending}
          onCancel={() => setIsEditing(false)}
          onSubmit={(fields) => createVersionMutation.mutate(fields)}
        />
        {createVersionMutation.isError ? (
          <p className="mt-2 text-sm text-[#B42318]">Não foi possível salvar a nova versão.</p>
        ) : null}
      </Panel>
    );
  }

  return (
    <Panel
      headerAction={<Button onClick={() => setIsEditing(true)} variant="secondary">Editar campos</Button>}
      title={detail.name}
    >
      {!latestVersion ? (
        <EmptyState message="Este template ainda não tem uma versão publicada." />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[#66736D]">Versão {latestVersion.version}</p>
          {latestVersion.fields.map((field) => (
            <div className="rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-3 text-sm" key={field.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{field.label}</p>
                {field.isRequired ? <span className="text-xs font-semibold text-[#B42318]">Obrigatório</span> : null}
              </div>
              <p className="mt-1 text-xs text-[#66736D]">
                {fieldTypeOptions.find((option) => option.value === field.type)?.label ?? field.type} · chave: {field.key}
              </p>
              {Object.keys(field.validation).length > 0 ? (
                <p className="mt-1 font-mono text-xs text-[#66736D]">{JSON.stringify(field.validation)}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function ChecklistFieldsForm({
  initialFields,
  isPending,
  onCancel,
  onSubmit
}: {
  initialFields: readonly ChecklistFieldDefinition[];
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (fields: readonly ChecklistFieldInput[]) => void;
}): React.ReactNode {
  const [rows, setRows] = useState<readonly FieldFormRow[]>(
    initialFields.length > 0 ? initialFields.map(toFieldFormRow) : [emptyFieldRow()]
  );

  function updateRow(index: number, patch: Partial<FieldFormRow>): void {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number): void {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  const canSubmit = rows.length > 0 && rows.every((row) => row.key.trim() && row.label.trim());

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) {
          onSubmit(rows.map(toFieldInput));
        }
      }}
    >
      {rows.map((row, index) => (
        <div className="grid gap-2 rounded-md border border-[#D8DEDA] bg-white p-3 sm:grid-cols-2" key={row.rowId}>
          <input
            aria-label="Chave do campo"
            className={inputClassName}
            onChange={(event) => updateRow(index, { key: event.target.value })}
            placeholder="Chave (ex: pressao_entrada)"
            value={row.key}
          />
          <input
            aria-label="Rótulo do campo"
            className={inputClassName}
            onChange={(event) => updateRow(index, { label: event.target.value })}
            placeholder="Rótulo exibido ao técnico"
            value={row.label}
          />
          <select
            aria-label="Tipo do campo"
            className={inputClassName}
            onChange={(event) => updateRow(index, { type: event.target.value as ChecklistFieldType })}
            value={row.type}
          >
            {fieldTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[#4F5A55]">
            <input
              checked={row.isRequired}
              onChange={(event) => updateRow(index, { isRequired: event.target.checked })}
              type="checkbox"
            />
            Obrigatório
          </label>
          {row.type === "number" ? (
            <>
              <input
                aria-label="Valor mínimo"
                className={inputClassName}
                onChange={(event) => updateRow(index, { min: event.target.value })}
                placeholder="Mínimo (opcional)"
                type="number"
                value={row.min}
              />
              <input
                aria-label="Valor máximo"
                className={inputClassName}
                onChange={(event) => updateRow(index, { max: event.target.value })}
                placeholder="Máximo (opcional)"
                type="number"
                value={row.max}
              />
            </>
          ) : null}
          {row.type === "text" ? (
            <input
              aria-label="Padrão regex"
              className={inputClassName}
              onChange={(event) => updateRow(index, { pattern: event.target.value })}
              placeholder="Padrão regex (opcional)"
              value={row.pattern}
            />
          ) : null}
          <div className="sm:col-span-2">
            <Button onClick={() => removeRow(index)} type="button" variant="secondary">Remover campo</Button>
          </div>
        </div>
      ))}
      <Button onClick={() => setRows((current) => [...current, emptyFieldRow()])} type="button" variant="secondary">
        Adicionar campo
      </Button>
      <div className="flex gap-2">
        <Button disabled={isPending || !canSubmit} type="submit" variant="primary">
          {isPending ? "Salvando..." : "Publicar nova versão"}
        </Button>
        <Button onClick={onCancel} type="button" variant="secondary">Cancelar</Button>
      </div>
    </form>
  );
}

function TemplateListState({
  children,
  onRetry,
  query
}: {
  children: (data: ChecklistTemplateListResponse) => React.ReactNode;
  onRetry: () => void;
  query: ReturnType<typeof useQuery<ChecklistTemplateListResponse, Error>>;
}): React.ReactNode {
  if (query.isLoading) {
    return <LoadingState message="Carregando templates..." />;
  }

  if (query.isError) {
    return <ErrorState message="Não foi possível carregar os templates." onRetry={onRetry} />;
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

const inputClassName = "h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]";

async function fetchChecklistTemplates(): Promise<ChecklistTemplateListResponse> {
  const response = await apiFetch("/checklist-templates");

  if (!response.ok) {
    throw new Error("Falha ao carregar templates de checklist.");
  }

  return response.json() as Promise<ChecklistTemplateListResponse>;
}

async function fetchChecklistTemplateDetail(id: string): Promise<ChecklistTemplateDetail> {
  const response = await apiFetch(`/checklist-templates/${id}`);

  if (!response.ok) {
    throw new Error("Falha ao carregar detalhe do template.");
  }

  return response.json() as Promise<ChecklistTemplateDetail>;
}

async function createChecklistVersion(
  id: string,
  fields: readonly ChecklistFieldInput[]
): Promise<ChecklistVersionSummary> {
  const response = await apiFetch(`/checklist-templates/${id}/versions`, {
    body: JSON.stringify({ fields }),
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("Falha ao publicar nova versão do checklist.");
  }

  return response.json() as Promise<ChecklistVersionSummary>;
}
