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

/**
 * BUG REAL CORRIGIDO (2026-10-08, "no navegador interno do Threads não
 * aparece nem o popup nem a faixa de baixar o app") — a causa raiz NÃO
 * estava em `ProfileAppPromoModal.tsx`/`MobileAppPromoBanner.tsx` (que
 * já tinham sido corrigidos antes, com try/catch no `localStorage`
 * deles). `LocaleProvider` envolve o app INTEIRO (`app/providers.tsx`),
 * acima de toda página, inclusive `app/u/[username]`. Esta função
 * (`readStoredLocale`) é chamada dentro do `useEffect` deste provider,
 * SEM try/catch — em navegadores internos que bloqueiam `localStorage`
 * (Threads/Instagram, modo de prévia de link), `window.localStorage.
 * getItem` lança exceção. Um throw não tratado dentro de um efeito
 * React pode interromper o resto dos efeitos agendados na MESMA leva
 * (passive effects flush) — incluindo os `useEffect` de montagem do
 * banner e do popup, que vivem bem abaixo na árvore. Por isso os dois
 * sumiam JUNTOS mesmo já tendo cada um o próprio try/catch: a exceção
 * de verdade não vinha deles, vinha daqui, mais acima na árvore, antes
 * dos efeitos deles rodarem. Corrigido na origem: se não der pra ler o
 * idioma salvo, segue com o padrão (pt-BR) em vez de travar o efeito.
 */
function readStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored in translations ? (stored as Locale) : null;
  } catch (error) {
    console.error("[LocaleProvider] localStorage indisponível ao ler idioma salvo, mantendo padrão", error);
    return null;
  }
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
    // BUG REAL CORRIGIDO (2026-10-08, mesma causa raiz documentada em
    // `readStoredLocale` acima) — também sem try/catch antes; embora
    // esta função só rode por ação explícita da pessoa (trocar idioma
    // nas Configurações), não pelo efeito de montagem automático,
    // protegida do mesmo jeito por consistência e porque Configurações
    // também pode ser aberta dentro de um navegador interno.
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      console.error("[LocaleProvider] Falha ao gravar idioma no localStorage", error);
    }
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
