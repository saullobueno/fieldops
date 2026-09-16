"use client";

import { Button } from "@fieldops/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { storeSession } from "../../lib/api-client";

interface LoginResponse {
  readonly actor: {
    readonly id: string;
    readonly organizationId: string;
  };
}

export default function LoginPage(): React.ReactNode {
  const router = useRouter();
  const [email, setEmail] = useState("admin@acmefield.example");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
      const response = await fetch(`${baseUrl}/auth/login`, {
        body: JSON.stringify({ email, password }),
        credentials: "include",
        headers: { "content-type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        setError("Email ou senha inválidos.");
        return;
      }

      const data = (await response.json()) as LoginResponse;
      storeSession({
        organizationId: data.actor.organizationId,
        userId: data.actor.id,
        userName: email
      });
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
        <h1 className="mt-1 text-lg font-semibold">Entrar</h1>

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
            Senha
            <input
              autoComplete="current-password"
              className="h-9 rounded-md border border-[#C7D0CB] bg-white px-3 text-sm outline-none focus:border-[#0E5F4B]"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-md border border-[#F4B5A9] bg-[#FFF5F3] px-3 py-2 text-sm text-[#8A1F11]">{error}</p>
          ) : null}

          <Button disabled={isSubmitting} type="submit" variant="primary">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
          <Link className="text-center text-sm text-[#0E5F4B] underline" href="/esqueci-senha">
            Esqueceu a senha?
          </Link>
        </form>

        <p className="mt-4 text-xs text-[#66736D]">
          Modo demo: admin@acmefield.example, ana@acmefield.example ou bruno@acmefield.example, senha demo1234.
        </p>
      </div>
    </main>
  );
}
