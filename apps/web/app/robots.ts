import type { MetadataRoute } from "next";

const SITE_URL = "https://seenlist.app";

/**
 * A PEDIDO (2026-09-04 — "preciso que o app ranqueie nas pesquisas do
 * Google") — não existia `robots.txt` nenhum: o Google (e qualquer
 * outro rastreador) não tinha nem confirmação de que podia indexar o
 * site, nem sabia onde achar o `sitemap.xml` (ver `app/sitemap.ts`,
 * ao lado). `disallow` cobre só o que É de verdade privado ou não faz
 * sentido aparecer numa busca (telas logadas, API, callback de auth,
 * túnel do Sentry, ferramenta de debug interna) — o resto (a landing,
 * "/about", "/privacy", "/terms", perfis públicos em "/u/...") fica
 * liberado. Next.js serve isto automaticamente em `/robots.txt`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/series",
        "/movies",
        "/library",
        "/profile",
        "/explore",
        "/lists",
        "/posts",
        "/episodes",
        "/follow-list",
        "/settings",
        "/discover-people",
        "/delete-account",
        "/debug",
        "/api/",
        "/auth/",
        "/monitoring",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
