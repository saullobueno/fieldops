"use client";

import { Button } from "@fieldops/ui";
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
  const [email, setEmail] = useState("ana@acmefield.example");
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-muted px-4 text-foreground">
      <div className="w-full rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase text-muted-foreground">FieldOps Mobile</p>
        <h1 className="mt-1 text-lg font-semibold">Entrar</h1>

        <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              autoComplete="username"
              className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-ring"
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
              className="h-9 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-ring"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          <Button disabled={isSubmitting} type="submit" variant="primary">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground">
          Modo demo: ana@acmefield.example ou bruno@acmefield.example, senha demo1234.
        </p>
      </div>
    </main>
  );
}
