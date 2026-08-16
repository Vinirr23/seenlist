import { cookies } from "next/headers";
import { translations, DEFAULT_LOCALE, type Locale } from "./translations";

const COOKIE_KEY = "seenlist_locale";

/**
 * A PEDIDO — achado real, auditoria profunda de tradução: páginas de
 * SERVIDOR (`async function Page(...)`, sem "use client") que buscam
 * dado do TMDB direto (ex.: `getMovieSummary` pra montar o título de
 * uma página de comentários) não tinham como saber o idioma — só
 * existia em `localStorage`, inacessível no servidor. `LocaleProvider`
 * agora também grava um cookie (`seenlist_locale`) sempre que o
 * idioma é definido — esta função lê esse cookie, com o mesmo padrão
 * pt-BR de sempre quando não existe (usuário novo, ainda sem cookie
 * definido nesta primeira visita).
 *
 * Uso: `const locale = await getServerLocale();` dentro de um
 * Server Component ou Route Handler.
 */
export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_KEY)?.value;
  return value && value in translations ? (value as Locale) : DEFAULT_LOCALE;
}

/**
 * Tradução simples, pra uso em Server Component — mesma função `t`
 * que `useTranslation()` expõe, só que sem hook (não dá pra usar
 * hook fora de Client Component). Sem interpolação de `{var}` — os
 * usos em Server Component até agora são só título estático; se
 * precisar de interpolação aqui no futuro, portar a mesma lógica de
 * `LocaleProvider.tsx`.
 */
export function translateServer(locale: Locale, key: string): string {
  return translations[locale][key] ?? translations[DEFAULT_LOCALE][key] ?? key;
}
