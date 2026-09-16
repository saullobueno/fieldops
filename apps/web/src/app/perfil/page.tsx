"use client";

import { AppShell, Button } from "@fieldops/ui";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { apiFetch } from "../../lib/api-client";
import { useRequireAuth } from "../../lib/use-require-auth";

export default function ProfilePage(): React.ReactNode {
  const { logout, session } = useRequireAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  });

  if (!session) {
    return null;
  }

  return (
    <AppShell
      activeHref="/perfil"
      headerEyebrow="Conta"
      headerTitle="Meu perfil"
      onLogout={() => void logout()}
      userLabel={session.userName}
    >
      <div className="max-w-sm p-6 max-sm:p-4">
        <section className="rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-4">
          <h2 className="text-sm font-semibold">Trocar senha</h2>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setFormError(undefined);

              if (newPassword.length < 8) {
                setFormError("A nova senha precisa ter pelo menos 8 caracteres.");
                return;
              }
              if (newPassword !== confirmPassword) {
                setFormError("As senhas não conferem.");
                return;
              }

              changePasswordMutation.mutate({ currentPassword, newPassword });
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Senha atual
              <input
                autoComplete="current-password"
                className={inputClassName}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                type="password"
                value={currentPassword}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Nova senha
              <input
                autoComplete="new-password"
                className={inputClassName}
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                type="password"
                value={newPassword}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Confirmar nova senha
              <input
                autoComplete="new-password"
                className={inputClassName}
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            {formError ? (
              <p className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] px-3 py-2 text-sm text-[#8A1F11]">{formError}</p>
            ) : null}
            {changePasswordMutation.isError ? (
              <p className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] px-3 py-2 text-sm text-[#8A1F11]">
                Senha atual incorreta.
              </p>
            ) : null}
            {changePasswordMutation.isSuccess ? (
              <p className="rounded-md border border-[#0E5F4B] bg-[#EEF5F1] px-3 py-2 text-sm text-[#0E5F4B]">
                Senha alterada com sucesso.
              </p>
            ) : null}

            <Button disabled={changePasswordMutation.isPending} type="submit" variant="primary">
              {changePasswordMutation.isPending ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}

const inputClassName = "h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]";

async function changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  const response = await apiFetch("/auth/change-password", { body: JSON.stringify(input), method: "POST" });
  if (!response.ok) {
    throw new Error("Falha ao trocar a senha.");
  }
}
