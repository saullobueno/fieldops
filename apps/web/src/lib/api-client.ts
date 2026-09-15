const TOKEN_STORAGE_KEY = "fieldops_token";

export interface StoredSession {
  readonly token: string;
  readonly userId: string;
  readonly organizationId: string;
  readonly userName: string;
}

export function getStoredSession(): StoredSession | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return undefined;
  }
}

export function storeSession(session: StoredSession): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

/**
 * Wrapper de `fetch` que injeta o token de sessão como Bearer token e
 * redireciona para /login quando a API responde 401 (sessão ausente/expirada).
 * Substitui os headers `x-fieldops-*` fixos que cada página fazia sozinha.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getStoredSession();
  const headers = new Headers(init.headers);

  if (session) {
    headers.set("authorization", `Bearer ${session.token}`);
  }

  // FormData nunca deve levar content-type explícito: o browser precisa gerar
  // o boundary do multipart sozinho ao serializar o body.
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, headers });

  if (response.status === 401 && typeof window !== "undefined") {
    clearSession();
    if (window.location.pathname !== "/login") {
      // Navegação forçada (fora da árvore React) para limpar todo o estado em
      // memória do app após uma sessão inválida/expirada — não é uma troca de
      // rota comum via useRouter().
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  return response;
}
