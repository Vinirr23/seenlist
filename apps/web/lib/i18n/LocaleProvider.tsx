"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { translations, DEFAULT_LOCALE, matchSupportedLocale, type Locale } from "./translations";

const STORAGE_KEY = "seenlist:locale";
/**
 * A PEDIDO — achado real, auditoria profunda de tradução: o idioma só
 * ficava salvo em `localStorage`, que o SERVIDOR nunca consegue ler.
 * Toda página que busca dado do TMDB no servidor (`async function
 * Page(...)`, sem "use client") ficava presa no padrão pt-BR, mesmo
 * com a pessoa tendo trocado de idioma. Cookie espelha o mesmo valor
 * — `next/headers` (`cookies()`) consegue ler isso em componente de
 * servidor, ver `getServerLocale()` no fim deste arquivo.
 */
const COOKIE_KEY = "seenlist_locale";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 ano

function writeLocaleCookie(locale: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEY}=${locale}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

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
      writeLocaleCookie(stored);
      return;
    }
    // Sem nada local ainda (primeiro acesso neste navegador) — busca
    // do perfil, pra um usuário que já escolheu idioma em outro
    // aparelho não cair no padrão aqui.
    const supabase = createClient();
    getCurrentAuthUser(supabase).then(({ data }) => {
      const saved = data.user?.user_metadata?.locale as Locale | undefined;
      if (saved && saved in translations) {
        setLocaleState(saved);
        writeLocaleCookie(saved);
        return;
      }
      // A PEDIDO — pessoa de verdade nova (sem preferência salva em
      // lugar nenhum): usa o idioma configurado no navegador em vez
      // de sempre abrir em pt-BR. `navigator.language` é a escolha
      // de verdade da pessoa (o que ela configurou no aparelho), não
      // uma suposição baseada em onde ela está.
      const matched = matchSupportedLocale(navigator.language);
      setLocaleState(matched);
      writeLocaleCookie(matched);
    });
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    writeLocaleCookie(next);
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
