import type { MetadataRoute } from "next";

const SITE_URL = "https://seenlist.app";

/**
 * FASE 6 (sublote 6C-6, 2026-10-22) — REMOVIDO `export const dynamic =
 * "force-dynamic"` que existia aqui desde 2026-10-09. Histórico real do
 * porquê ele existia (preservado pra quem for dar manutenção futura):
 * `fetchSitemapEligibleContent` (`lib/server/titlePublicContent.ts`)
 * chamava `createAdminClient()` (precisa de `SUPABASE_SERVICE_ROLE_KEY`,
 * ausente especificamente NO MOMENTO DO BUILD da Vercel) pra montar as
 * URLs de `/title/movie|series/[id]` — sem `force-dynamic`, o Next
 * tentava prerenderizar esta rota no build e quebrava com `Error
 * occurred prerendering page "/sitemap.xml" ... Variável de ambiente
 * ausente: SUPABASE_SERVICE_ROLE_KEY`.
 *
 * Agora que "/title/*" foi descontinuado (redirect pra "/download" em
 * `next.config.mjs`) e suas URLs removidas do sitemap (ver abaixo), a
 * única chamada que exigia `force-dynamic` não existe mais aqui — o
 * sitemap volta a ser 100% estático (as 4 URLs abaixo, fixas), exatamente
 * como era antes de 2026-10-09, então a rota pode voltar a ser gerada
 * uma única vez no build sem nenhum risco de quebrar por falta da
 * `SUPABASE_SERVICE_ROLE_KEY` (ela nunca mais é chamada por este
 * arquivo). `fetchSitemapEligibleContent`/`fetchTitleCommunityContent`
 * (em `lib/server/titlePublicContent.ts`) ficam sem nenhum consumidor
 * depois desta mudança — identificado para limpeza futura, não removido
 * ainda nesta sublote (decisão explícita do usuário).
 */

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

/**
 * A PEDIDO (2026-10-09 — SEO Fase 2). Entre 2026-10-09 e 2026-10-22 o
 * sitemap teve até três grupos de URL dinâmica além das 4 estáticas
 * abaixo (`/title/movie|series/[id]`, "/u/[username]", "/r/[reviewId]"),
 * todos vindos de `fetchSitemapEligibleContent`
 * (`lib/server/titlePublicContent.ts`).
 *
 * FASE 6 (sublotes 6C-4/6C-5/6C-6, 2026-10-22) — as três rotas públicas
 * dinâmicas foram descontinuadas, uma por sublote, nesta ordem: "/u/*"
 * (6C-4), "/r/*" (6C-5) e por fim "/title/*" (6C-6 — esta mudança,
 * ver redirect em `next.config.mjs`). Listar no sitemap uma URL que só
 * redireciona (nunca mais responde 200) seria ruim pra SEO, não
 * neutro — por isso nenhuma das três gera mais URL aqui, e o sitemap
 * volta a ter só as 4 URLs estáticas fixas abaixo, exatamente como
 * antes de 2026-10-09.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
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

  return staticPages;
}
