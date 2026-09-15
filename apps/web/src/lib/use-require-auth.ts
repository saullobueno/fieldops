"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { clearSession, getStoredSession, type StoredSession } from "./api-client";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getServerSnapshot(): StoredSession | undefined {
  return undefined;
}

/**
 * Lê a sessão via useSyncExternalStore (não useState+useEffect) porque
 * localStorage só existe no cliente: o snapshot do servidor é sempre
 * undefined, evitando divergência de hidratação entre SSR e o primeiro
 * render no navegador. Redireciona para /login quando não há sessão.
 */
export function useRequireAuth(): { session: StoredSession | undefined; logout: () => void } {
  const router = useRouter();
  const session = useSyncExternalStore(subscribe, getStoredSession, getServerSnapshot);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [router, session]);

  const logout = (): void => {
    clearSession();
    router.replace("/login");
  };

  return { logout, session };
}
