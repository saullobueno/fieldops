const TOKEN_STORAGE_KEY = "fieldops_token";
const SESSION_CHANGED_EVENT = "fieldops-session-changed";

export interface StoredSession {
  readonly userId: string;
  readonly organizationId: string;
  readonly userName: string;
}

// `useRequireAuth` lê esta função via `useSyncExternalStore`, que exige que o
// snapshot retorne a MESMA referência entre chamadas enquanto os dados não
// mudam — sem esse cache, `JSON.parse` cria um objeto novo a cada leitura e
// o React entra em loop infinito de re-render ("Maximum update depth exceeded").
let cachedRaw: string | null = null;
let cachedSession: StoredSession | undefined;

export function getStoredSession(): StoredSession | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (raw === cachedRaw) {
    return cachedSession;
  }

  cachedRaw = raw;

  if (!raw) {
    cachedSession = undefined;
    return cachedSession;
  }

  try {
    cachedSession = JSON.parse(raw) as StoredSession;
  } catch {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    cachedSession = undefined;
  }

  return cachedSession;
}

export function storeSession(session: StoredSession): void {
  cachedSession = session;
  cachedRaw = JSON.stringify(session);
  window.localStorage.setItem(TOKEN_STORAGE_KEY, cachedRaw);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function clearSession(): void {
  cachedRaw = null;
  cachedSession = undefined;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function subscribeToSessionChanges(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(SESSION_CHANGED_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SESSION_CHANGED_EVENT, callback);
  };
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
}

/**
 * Wrapper de `fetch` que envia o cookie httpOnly de sessão (`credentials:
 * "include"`, necessário porque API e web são origens diferentes mesmo em
 * dev) e redireciona para /login quando a API responde 401 (sessão ausente/
 * expirada/revogada). O token de sessão em si nunca fica acessível a este
 * código — ele só existe no cookie, fora do alcance do JS do navegador.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  // FormData nunca deve levar content-type explícito: o browser precisa gerar
  // o boundary do multipart sozinho ao serializar o body.
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, { ...init, credentials: "include", headers });

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

/**
 * Faz o round-trip de logout no servidor (necessário porque JS não consegue
 * apagar um cookie httpOnly sozinho) e limpa o marcador de sessão local.
 */
export async function logoutRequest(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } finally {
    clearSession();
  }
}
