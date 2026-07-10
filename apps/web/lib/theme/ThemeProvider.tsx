"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type ThemePreference = "dark" | "light" | "system";

const STORAGE_KEY = "seenlist:theme";
const DEFAULT_THEME: ThemePreference = "dark";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "dark" || value === "light" || value === "system";
}

function resolveSystemPreference(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyThemeClass(theme: ThemePreference) {
  const resolved = theme === "system" ? resolveSystemPreference() : theme;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(resolved);
}

/**
 * Mesma estratégia de persistência do idioma: `localStorage`
 * (resposta imediata) + `user_metadata` do Supabase Auth (entre
 * dispositivos), sem tabela nova. As cores em si não mudaram de
 * lugar nenhum — só passaram a ser variáveis CSS (ver
 * app/globals.css e packages/config/src/tailwind-tokens.ts), então
 * aplicar a classe `.dark`/`.light` aqui já basta pro app inteiro
 * reagir, sem precisar tocar em nenhum componente.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(DEFAULT_THEME);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial = isThemePreference(stored) ? stored : null;

    if (initial) {
      setThemeState(initial);
      applyThemeClass(initial);
    } else {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data }) => {
        const saved = data.user?.user_metadata?.theme;
        const resolved = isThemePreference(saved) ? saved : DEFAULT_THEME;
        setThemeState(resolved);
        applyThemeClass(resolved);
      });
    }
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => applyThemeClass("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  function setTheme(next: ThemePreference) {
    setThemeState(next);
    applyThemeClass(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    const supabase = createClient();
    supabase.auth.updateUser({ data: { theme: next } }).catch((error) => {
      console.error("[theme] Falha ao salvar tema no perfil", error);
    });
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme precisa estar dentro de <ThemeProvider>");
  return context;
}
