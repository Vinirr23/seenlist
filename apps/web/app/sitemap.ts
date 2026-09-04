import type { MetadataRoute } from "next";

const SITE_URL = "https://seenlist.app";

/**
 * A PEDIDO (2026-09-04 — SEO do site) — junto com `app/robots.ts`.
 * Só as páginas PÚBLICAS de conteúdo real entram aqui (a landing, o
 * "/about" e as páginas legais) — nada de rota logada, nem "/login"
 * ou "/register" (são telas de ação, não conteúdo pra rankear) nem
 * "/beta" (página antiga de waitlist, de antes de "/" virar a landing
 * de verdade — deixei de fora pra não competir com "/" pelo mesmo
 * assunto "o que é o SeenList"; se ainda estiver em uso, me avisa que
 * a gente decide o que fazer com ela).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
