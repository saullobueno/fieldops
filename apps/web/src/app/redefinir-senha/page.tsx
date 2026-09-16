"use client";

import { Button } from "@fieldops/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiBaseUrl, storeSession } from "../../lib/api-client";

interface ResetPasswordResponse {
  readonly actor: { readonly id: string; readonly organizationId: string };
}

function readTokenFromLocation(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return new URLSearchParams(window.location.search).get("token") ?? undefined;
}

export default function ResetPasswordPage(): React.ReactNode {
  const router = useRouter();
  const [token] = useState<string | undefined>(readTokenFromLocation);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    if (!token) {
      setError("Link de redefinição inválido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/auth/reset-password`, {
        body: JSON.stringify({ password, token }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        setError("Link de redefinição inválido ou expirado.");
        return;
      }

      const data = (await response.json()) as ResetPasswordResponse;
      storeSession({ organizationId: data.actor.organizationId, userId: data.actor.id, userName: email });
      router.replace("/");
    } catch {
      setError("Não foi possível conectar à API. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6F5] px-4 text-[#151A18]">
      <div className="w-full max-w-sm rounded-lg border border-[#D8DEDA] bg-[#FBFCFB] p-6 shadow-sm">
        <p className="text-xs font-medium uppercase text-[#66736D]">FieldOps</p>
        <h1 className="mt-1 text-lg font-semibold">Redefinir senha</h1>

        {!token ? (
          <p className="mt-4 rounded-md border border-[#F4B5A9] bg-[#FFF5F3] px-3 py-2 text-sm text-[#8A1F11]">
            Link de redefinição inválido. Solicite um novo em &quot;Esqueci minha senha&quot;.
          </p>
        ) : (
          <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                autoComplete="username"
                className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Nova senha
              <input
                autoComplete="new-password"
                className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Confirmar senha
              <input
                autoComplete="new-password"
                className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>

            {error ? (
              <p className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] px-3 py-2 text-sm text-[#8A1F11]">{error}</p>
            ) : null}

            <Button disabled={isSubmitting} type="submit" variant="primary">
              {isSubmitting ? "Confirmando..." : "Redefinir e entrar"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
