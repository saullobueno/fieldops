"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "fieldops-theme";
const THEME_CHANGE_EVENT = "fieldops-theme-change";

export type Theme = "light" | "dark";

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
}

function subscribeToTheme(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getThemeSnapshot(): Theme {
  return window.localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

function getThemeServerSnapshot(): Theme {
  return "dark";
}

export interface UseThemeResult {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
  readonly toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getThemeServerSnapshot);

  function setTheme(next: Theme): void {
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  function toggleTheme(): void {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { setTheme, theme, toggleTheme };
}
