"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { translations, DEFAULT_LOCALE, type Locale } from "./translations";

const STORAGE_KEY = "seenlist:locale";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && stored in translations ? (stored as Locale) : null;
}

/**
 * "A seleção deve ser salva no perfil do usuário... ao abrir de
 * novo, o idioma escolhido deve permanecer" — duas camadas:
 * `localStorage` responde na hora (não espera round-trip de rede
 * pra trocar a interface) e `user_metadata` do Supabase Auth
 * persiste entre dispositivos. Nenhuma tabela nova — `user_metadata`
 * já é parte de `auth.users`, só uma coluna JSON que o próprio
 * Supabase gerencia, atualizável via `supabase.auth.updateUser()`.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored) {
      setLocaleState(stored);
      return;
    }
    // Sem nada local ainda (primeiro acesso neste navegador) — busca
    // do perfil, pra um usuário que já escolheu idioma em outro
    // aparelho não cair no padrão aqui.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const saved = data.user?.user_metadata?.locale as Locale | undefined;
      if (saved && saved in translations) setLocaleState(saved);
    });
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    const supabase = createClient();
    supabase.auth.updateUser({ data: { locale: next } }).catch((error) => {
      console.error("[locale] Falha ao salvar idioma no perfil", error);
    });
  }

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => {
      const dictionary = translations[locale];
      let value = dictionary[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replace(`{${name}}`, String(replacement));
        }
      }
      return value;
    };
  }, [locale]);

  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useTranslation precisa estar dentro de <LocaleProvider>");
  return context;
}
