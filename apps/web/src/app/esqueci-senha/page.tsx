"use client";

import { Button } from "@fieldops/ui";
import Link from "next/link";
import { useState } from "react";

import { apiBaseUrl } from "../../lib/api-client";

interface ForgotPasswordResponse {
  readonly resetLink?: string;
}

export default function ForgotPasswordPage(): React.ReactNode {
  const [email, setEmail] = useState("");
  const [resetLink, setResetLink] = useState<string | undefined>(undefined);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch(`${apiBaseUrl()}/auth/forgot-password`, {
        body: JSON.stringify({ email }),
        headers: { "content-type": "application/json" },
        method: "POST"
      });

      if (!response.ok) {
        setError("Não foi possível conectar à API. Tente novamente.");
        return;
      }

      const data = (await response.json()) as ForgotPasswordResponse;
      setResetLink(data.resetLink);
      setHasSubmitted(true);
    } catch {
      setError("Não foi possível conectar à API. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-medium uppercase text-muted-foreground">FieldOps</p>
        <h1 className="mt-1 text-lg font-semibold">Esqueci minha senha</h1>

        {hasSubmitted ? (
          <div className="mt-5 space-y-3 text-sm">
            <p>Se o email informado existir e estiver ativo, um link de redefinição foi gerado.</p>
            {resetLink ? (
              <div className="rounded-md border border-primary bg-accent p-3 text-xs text-primary">
                <p className="font-semibold">Modo demo: link de redefinição</p>
                <p className="mt-1">Este projeto não tem envio de email configurado — o link é mostrado aqui diretamente.</p>
                <a className="mt-2 block break-all font-mono underline" href={resetLink}>{resetLink}</a>
              </div>
            ) : null}
            <Link className="block text-primary underline" href="/login">Voltar ao login</Link>
          </div>
        ) : (
          <form className="mt-5 flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <input
                autoComplete="username"
                className="h-9 rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-ring"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : null}

            <Button disabled={isSubmitting} type="submit" variant="primary">
              {isSubmitting ? "Enviando..." : "Enviar link de redefinição"}
            </Button>
            <Link className="text-center text-sm text-primary underline" href="/login">Voltar ao login</Link>
          </form>
        )}
      </div>
    </main>
  );
}
