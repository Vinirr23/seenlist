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
/**
 * CORREÇÃO (2026-09-16, achado no Search Console — "O sitemap está em
 * HTML") — `lastModified: new Date()` mandava a data/hora exata do
 * build pra TODAS as páginas, sempre, mesmo quando nada mudou nelas.
 * Isso é pior do que não informar a data: sinaliza pro Google que o
 * conteúdo muda a cada deploy, quando na real quase nunca muda.
 *
 * Só "/privacy" e "/terms" têm uma data real e confiável: o texto
 * "Última atualização" escrito na própria página (`app/privacy/page.tsx`
 * e `app/terms/page.tsx`, linha 20 de cada — mantém os dois em sincronia
 * na próxima vez que o texto legal mudar). "/" e "/about" não têm
 * nenhuma fonte de data real (não são conteúdo versionado tipo post de
 * blog, é só a landing) — por isso o campo `lastModified` fica de fora
 * delas, em vez de inventar uma data.
 */
const LEGAL_PAGES_LAST_UPDATED = new Date("2026-08-05T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: LEGAL_PAGES_LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: LEGAL_PAGES_LAST_UPDATED,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
