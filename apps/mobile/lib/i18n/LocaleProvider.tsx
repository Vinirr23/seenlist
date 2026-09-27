import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import { translations, DEFAULT_LOCALE, matchSupportedLocale, type Locale } from "./translations";

const STORAGE_KEY = "seenlist:locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** true enquanto a preferência salva ainda está sendo lida do AsyncStorage — evita um "flash" de pt-BR antes de aplicar o idioma escolhido. */
  isLoading: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Equivalente nativo do `LocaleProvider.tsx` do web. Diferença
 * central: o web guarda a escolha num cookie (lido no servidor,
 * então nunca há "flash" de idioma errado); o app nativo não tem
 * servidor por perto, então guarda no `AsyncStorage` e lê de volta
 * na montagem — por isso o `isLoading`, pra quem quiser evitar
 * renderizar conteúdo antes da preferência real carregar (a maioria
 * das telas pode ignorar isso e usar o default enquanto isso, já que
 * a troca é rápida e pt-BR já é o padrão da maioria dos usuários).
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === "pt-BR" || saved === "en" || saved === "es") {
          setLocaleState(saved);
          return;
        }
        // A PEDIDO — pessoa de verdade nova (nada salvo ainda): usa
        // o idioma configurado no aparelho em vez de sempre abrir
        // em pt-BR. `Localization.getLocales()[0]` é a escolha de
        // verdade da pessoa (o que ela configurou no telefone).
        const deviceLocale = Localization.getLocales()[0]?.languageTag;
        setLocaleState(matchSupportedLocale(deviceLocale));
      })
      .finally(() => setIsLoading(false));
  }, []);

  // CORREÇÃO DE DESEMPENHO (2026-09-27, Etapa 1B, item 3) — antes era
  // `function setLocale(...)` solta, recriada a cada render; envolvida
  // em `useCallback` com deps `[]` (não fecha sobre nada que mude —
  // `setLocaleState` é a função de estado do `useState`, garantida
  // estável pelo React, e `STORAGE_KEY` é constante do módulo) pra ter
  // identidade estável de verdade, sem precisar de nenhum
  // eslint-disable no `useMemo` do `value` logo abaixo.
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((error) => {
      console.error("[LocaleProvider] Falha ao salvar idioma", error);
    });
  }, []);

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

  /*
   * CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance —
   * item 3 da Etapa 1B: "LocaleProvider — identidade estável do
   * contexto") — o `value` era um objeto literal criado INLINE aqui,
   * uma referência nova a cada render deste provider (que envolve o
   * app inteiro, em `app/_layout.tsx`). Isso derruba a comparação rasa
   * de Context pra todo componente que usa `useTranslation()` (130+
   * arquivos), inclusive dentro de `memo()` — `memo` não blinda contra
   * mudança de Context consumido internamente. `AuthProvider.tsx` já
   * resolve isso com `useMemo`; mesmo princípio aqui. Puramente
   * técnico: `t`/`setLocale`/`locale`/`isLoading` continuam
   * exatamente os mesmos, só a IDENTIDADE do objeto que os agrupa
   * passa a ser estável entre renders que não mudam nenhum deles.
   */
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, isLoading }),
    [locale, setLocale, t, isLoading]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useTranslation precisa estar dentro de <LocaleProvider>");
  return context;
}
