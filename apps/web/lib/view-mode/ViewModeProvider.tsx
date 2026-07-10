"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type ViewMode = "grid" | "list";

const STORAGE_KEY = "seenlist:viewMode";
const DEFAULT_VIEW_MODE: ViewMode = "grid";

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

function isViewMode(value: unknown): value is ViewMode {
  return value === "grid" || value === "list";
}

/**
 * Ajuste — Alternar visualização: mesma estratégia de persistência
 * já usada pra idioma/tema (`lib/i18n/LocaleProvider.tsx`,
 * `lib/theme/ThemeProvider.tsx`) — `localStorage` responde na hora,
 * `user_metadata` do Supabase Auth mantém entre dispositivos. Nenhuma
 * tabela nova, nenhuma query nova de leitura (só grava quando o
 * usuário troca o modo).
 */
export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(DEFAULT_VIEW_MODE);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isViewMode(stored)) {
      setViewModeState(stored);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const saved = data.user?.user_metadata?.viewMode;
      if (isViewMode(saved)) setViewModeState(saved);
    });
  }, []);

  function setViewMode(next: ViewMode) {
    setViewModeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    const supabase = createClient();
    supabase.auth.updateUser({ data: { viewMode: next } }).catch((error) => {
      console.error("[view-mode] Falha ao salvar preferência de visualização", error);
    });
  }

  return <ViewModeContext.Provider value={{ viewMode, setViewMode }}>{children}</ViewModeContext.Provider>;
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) throw new Error("useViewMode precisa estar dentro de <ViewModeProvider>");
  return context;
}
