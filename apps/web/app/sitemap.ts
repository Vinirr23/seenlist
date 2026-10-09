import type { MetadataRoute } from "next";
import { fetchSitemapEligibleContent } from "@/lib/server/titlePublicContent";

const SITE_URL = "https://seenlist.app";

/**
 * BUG REAL CORRIGIDO (2026-10-09, achado no `next build` desta mesma
 * Fase 2 — `/sitemap.xml` saiu marcado "○ (Static)" na tabela de
 * rotas) — até a Fase 1 isso nunca foi problema: as 4 URLs antigas
 * são todas fixas, geradas uma vez no build e nunca precisam mudar
 * de novo. Agora que o sitemap também lista título/perfil/review (via
 * `fetchSitemapEligibleContent`, que consulta o Supabase), um título
 * novo com review, um perfil publicado, uma review nova, nenhum
 * apareceria no sitemap até o próximo deploy caso o resultado ficasse
 * congelado no estado do banco NO MOMENTO DO BUILD.
 *
 * CAUSA RAIZ REAL (2026-10-09, achada no log de build da Vercel, não
 * localmente) — a primeira tentativa de correção foi `export const
 * revalidate = 3600` (ISR). Funcionou local (o `.env.local` tem a
 * `SUPABASE_SERVICE_ROLE_KEY`), mas quebrou o build na Vercel:
 * `Error occurred prerendering page "/sitemap.xml" ... Variável de
 * ambiente ausente: SUPABASE_SERVICE_ROLE_KEY`. ISR ainda exige uma
 * geração ESTÁTICA inicial NO MOMENTO DO BUILD (antes de qualquer
 * requisição real) — e só nesse momento específico a chave de serviço
 * não está disponível. `fetchSitemapEligibleContent` chama
 * `createAdminClient()` (precisa dessa chave) — exatamente como
 * `reviewShareCard.ts`/`profileShareCard.ts` já fazem para `/r/` e
 * `/u/`, só que essas duas rotas são 100% dinâmicas (nunca
 * prerenderizadas), nunca precisaram da chave no build. `force-dynamic`
 * alinha o sitemap ao mesmo padrão: a ROTA nunca tenta gerar no build,
 * só roda em runtime (onde a chave sempre esteve disponível).
 *
 * O cache de ~1h (pedido explícito: evitar consultar o Supabase em
 * toda visita do Googlebot) NÃO depende de `revalidate` de rota —
 * `force-dynamic` desliga justamente esse cache de ROTA. Em vez disso,
 * o cache vive um nível abaixo, nos DADOS: `fetchSitemapEligibleContent`
 * (em `lib/server/titlePublicContent.ts`) é envolvida em
 * `unstable_cache(..., { revalidate: 3600 })`, a API nativa do
 * Next.js 15 pra cache de dados independente de rota — essa, sim,
 * roda só em runtime (nunca no build), então não reintroduz o
 * problema original. A mesma função também guarda o último resultado
 * bem-sucedido e o devolve se o Supabase falhar temporariamente, em
 * vez de deixar o sitemap quebrar ou sair incompleto (ver comentário
 * em `titlePublicContent.ts`).
 */
export const dynamic = "force-dynamic";

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
 * A PEDIDO (2026-10-09 — SEO Fase 2). Até aqui o sitemap só tinha as
 * 4 URLs estáticas abaixo — nunca teve conteúdo dinâmico, porque até
 * agora não existia nenhuma página pública de filme/série/perfil/
 * review (ver `SEENLIST-SEO-FASE2-plano-tecnico-2026-10-09.md`, seção
 * de correção à Fase 1). Agora entram três grupos de URL dinâmica:
 *
 * - `/title/movie|series/[id]` — só títulos com pelo menos 1 review
 *   pública de nível de título (mesmo critério de elegibilidade de
 *   `generateMetadata`/JSON-LD dessas páginas, ver `fetchTitle
 *   CommunityContent` — robots e sitemap ficam sempre em sincronia,
 *   de propósito).
 * - `/u/[username]` — toda conta com `profile_visibility = 'public'`
 *   (mesmo critério que já libera a rota no middleware). Decisão do
 *   usuário (2026-10-09): incluir agora, não só filme/série.
 * - `/r/[reviewId]` — toda review pública não apagada, com nota e/ou
 *   texto. Idem.
 *
 * Os três grupos vêm de UMA função só, `fetchSitemapEligibleContent`
 * (`lib/server/titlePublicContent.ts`) — duas consultas no total
 * (perfis públicos + reviews públicas, cada uma paginada), nunca uma
 * consulta por item nem a mesma consulta repetida duas vezes.
 *
 * `generateSitemaps()` (nativo do Next 15, divide em `/sitemap/0.xml`,
 * `/sitemap/1.xml`...) só é necessário acima de ~50 mil URLs — fora do
 * volume atual do SeenList; se o volume crescer a esse ponto, a
 * migração é só trocar a forma de exportar esta função, sem tocar na
 * lógica de elegibilidade acima.
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

  const { titles, profiles, reviews } = await fetchSitemapEligibleContent();

  const titlePages: MetadataRoute.Sitemap = titles.map((t) => ({
    url: `${SITE_URL}/title/${t.mediaType}/${t.mediaId}`,
    lastModified: new Date(t.lastReviewAt),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const profilePages: MetadataRoute.Sitemap = profiles.map((p) => ({
    url: `${SITE_URL}/u/${p.username}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const reviewPages: MetadataRoute.Sitemap = reviews.map((r) => ({
    url: `${SITE_URL}/r/${r.reviewId}`,
    lastModified: new Date(r.updatedAt),
    changeFrequency: "monthly",
    priority: 0.3,
  }));

  return [...staticPages, ...titlePages, ...profilePages, ...reviewPages];
}
