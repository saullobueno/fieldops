"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { getStoredSession, logoutRequest, subscribeToSessionChanges, type StoredSession } from "./api-client";

function subscribe(callback: () => void): () => void {
  return subscribeToSessionChanges(callback);
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
export function useRequireAuth(): { session: StoredSession | undefined; logout: () => Promise<void> } {
  const router = useRouter();
  const session = useSyncExternalStore(subscribe, getStoredSession, getServerSnapshot);

  useEffect(() => {
    if (!session) {
      const redirectTimer = window.setTimeout(() => {
        if (!getStoredSession()) {
          router.replace("/login");
        }
      }, 0);

      return () => window.clearTimeout(redirectTimer);
    }

    return undefined;
  }, [router, session]);

  const logout = async (): Promise<void> => {
    await logoutRequest();
    router.replace("/login");
  };

  return { logout, session };
}
