"use client";

import type { NamedOption, UserAccountSummary } from "@fieldops/types";
import { AppShell, Button } from "@fieldops/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

const statusLabel: Record<UserAccountSummary["status"], string> = {
  active: "Ativo",
  disabled: "Desativado",
  invited: "Convidado"
};

export default function UsersPage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const queryClient = useQueryClient();
  const [inviteLink, setInviteLink] = useState<string | undefined>(undefined);

  const usersQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchUsers,
    queryKey: ["admin-users"]
  });
  const rolesQuery = useQuery({
    enabled: Boolean(session),
    queryFn: fetchRoles,
    queryKey: ["admin-roles"]
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: async (result) => {
      setInviteLink(result.inviteLink);
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    }
  });
  const resendMutation = useMutation({
    mutationFn: resendInvite,
    onSuccess: (result) => setInviteLink(result.inviteLink)
  });
  const disableMutation = useMutation({
    mutationFn: disableUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] })
  });
  const enableMutation = useMutation({
    mutationFn: enableUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] })
  });

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/usuarios"
      headerEyebrow="Administração"
      headerTitle="Usuários"
      onLogout={() => void logout()}
      userLabel={session.userName}
    >
      <div className="grid flex-1 gap-5 p-6 xl:grid-cols-[1fr_360px] max-sm:p-4">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <h2 className="text-sm font-semibold">Usuários da organização</h2>
          <div className="mt-4">
            {usersQuery.isLoading ? <StateMessage message="Carregando usuários..." /> : null}
            {usersQuery.isError ? (
              <StateMessage message="Não foi possível carregar os usuários." tone="error" />
            ) : null}
            {usersQuery.data ? (
              <UserTable
                isMutating={resendMutation.isPending || disableMutation.isPending || enableMutation.isPending}
                onDisable={(id) => disableMutation.mutate(id)}
                onEnable={(id) => enableMutation.mutate(id)}
                onResendInvite={(id) => resendMutation.mutate(id)}
                users={usersQuery.data}
              />
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <h2 className="text-sm font-semibold">Convidar usuário</h2>
          <div className="mt-4">
            <InviteForm
              isPending={inviteMutation.isPending}
              onSubmit={(input) => inviteMutation.mutate(input)}
              roles={rolesQuery.data ?? []}
            />
            {inviteMutation.isError ? (
              <p className="mt-2 text-sm text-[#B42318]">
                {inviteMutation.error instanceof Error ? inviteMutation.error.message : "Não foi possível convidar o usuário."}
              </p>
            ) : null}
            {inviteLink ? (
              <div className="mt-4 rounded-md border border-[#0E5F4B] bg-[#EEF5F1] p-3 text-xs text-[#0E5F4B]">
                <p className="font-semibold">Modo demo: link de convite</p>
                <p className="mt-1 break-all">
                  Este projeto não tem envio de email configurado — copie o link abaixo e envie manualmente.
                </p>
                <a className="mt-2 block break-all font-mono underline" href={inviteLink}>{inviteLink}</a>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function UserTable({
  isMutating,
  onDisable,
  onEnable,
  onResendInvite,
  users
}: {
  isMutating: boolean;
  onDisable: (id: string) => void;
  onEnable: (id: string) => void;
  onResendInvite: (id: string) => void;
  users: readonly UserAccountSummary[];
}): React.ReactNode {
  if (users.length === 0) {
    return <StateMessage message="Nenhum usuário cadastrado." />;
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div className="rounded-md border border-[#D8DEDA] bg-white p-3 text-sm" key={user.id}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-[#66736D]">{user.email}</p>
            </div>
            <span className="text-xs font-semibold text-[#4F5A55]">{statusLabel[user.status]}</span>
          </div>
          <p className="mt-2 text-xs text-[#66736D]">
            {user.roles.length > 0 ? user.roles.map((role) => role.name).join(", ") : "Sem papel atribuído"}
          </p>
          <div className="mt-2 flex gap-2">
            {user.status === "invited" ? (
              <Button disabled={isMutating} onClick={() => onResendInvite(user.id)} variant="secondary">
                Reenviar convite
              </Button>
            ) : null}
            {user.status === "active" ? (
              <Button disabled={isMutating} onClick={() => onDisable(user.id)} variant="secondary">
                Desativar
              </Button>
            ) : null}
            {user.status === "disabled" ? (
              <Button disabled={isMutating} onClick={() => onEnable(user.id)} variant="secondary">
                Reativar
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function InviteForm({
  isPending,
  onSubmit,
  roles
}: {
  isPending: boolean;
  onSubmit: (input: { email: string; name: string; roleIds: string[] }) => void;
  roles: readonly NamedOption[];
}): React.ReactNode {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ email, name, roleIds: roleId ? [roleId] : [] });
        setEmail("");
        setName("");
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        Nome
        <input
          className={inputClassName}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          className={inputClassName}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Papel
        <select className={inputClassName} onChange={(event) => setRoleId(event.target.value)} value={roleId}>
          <option value="">Sem papel</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </label>
      <Button disabled={isPending} type="submit" variant="primary">
        {isPending ? "Convidando..." : "Convidar"}
      </Button>
    </form>
  );
}

function StateMessage({ message, tone = "neutral" }: { message: string; tone?: "neutral" | "error" }): React.ReactNode {
  const className =
    tone === "error"
      ? "rounded-md border border-[#F4B5A9] bg-[#FFF5F3] p-4 text-sm text-[#8A1F11]"
      : "rounded-md border border-[#D8DEDA] bg-[#F9FAF9] p-4 text-sm text-[#66736D]";

  return <div className={className}>{message}</div>;
}

const inputClassName = "h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]";

async function fetchUsers(): Promise<readonly UserAccountSummary[]> {
  const response = await apiFetch("/admin/users");
  if (!response.ok) {
    throw new Error("Falha ao carregar usuários.");
  }
  return response.json() as Promise<readonly UserAccountSummary[]>;
}

async function fetchRoles(): Promise<readonly NamedOption[]> {
  const response = await apiFetch("/admin/roles");
  if (!response.ok) {
    throw new Error("Falha ao carregar papéis.");
  }
  return response.json() as Promise<readonly NamedOption[]>;
}

async function inviteUser(input: { email: string; name: string; roleIds: string[] }): Promise<{ inviteLink: string }> {
  const response = await apiFetch("/admin/users", { body: JSON.stringify(input), method: "POST" });
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, "Falha ao convidar usuário."));
  }
  return (response.json() as Promise<{ inviteLink: string }>);
}

async function resendInvite(id: string): Promise<{ inviteLink: string }> {
  const response = await apiFetch(`/admin/users/${id}/resend-invite`, { method: "POST" });
  if (!response.ok) {
    throw new Error("Falha ao reenviar convite.");
  }
  return response.json() as Promise<{ inviteLink: string }>;
}

async function disableUser(id: string): Promise<UserAccountSummary> {
  const response = await apiFetch(`/admin/users/${id}/disable`, { method: "POST" });
  if (!response.ok) {
    throw new Error("Falha ao desativar usuário.");
  }
  return response.json() as Promise<UserAccountSummary>;
}

async function enableUser(id: string): Promise<UserAccountSummary> {
  const response = await apiFetch(`/admin/users/${id}/enable`, { method: "POST" });
  if (!response.ok) {
    throw new Error("Falha ao reativar usuário.");
  }
  return response.json() as Promise<UserAccountSummary>;
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(" ");
    }
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}
