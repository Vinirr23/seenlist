import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

  function setLocale(next: Locale) {
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch((error) => {
      console.error("[LocaleProvider] Falha ao salvar idioma", error);
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

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, isLoading }}>{children}</LocaleContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useTranslation precisa estar dentro de <LocaleProvider>");
  return context;
}
