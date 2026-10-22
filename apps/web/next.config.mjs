import { withSentryConfig } from "@sentry/nextjs";
import createBundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = createBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      // TASK-067 — ilustração de personagem de anime (Jikan/MyAnimeList, lib/anime/jikan.ts)
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      // TASK-168 — AniList (lib/anime/anilist.ts), fonte principal de personagem de anime agora
      { protocol: "https", hostname: "s4.anilist.co" },
    ],
  },
  transpilePackages: ["@seenlist/ui", "@seenlist/types", "@seenlist/utils", "@seenlist/hooks", "@seenlist/config"],
  /**
   * FASE 6 (sublote 6C-4, 2026-10-22) — descontinuação de /u/[username]
   * (perfil público compartilhável). Confirmado na documentação oficial
   * do Next.js (nextjs.org/docs/app/api-reference/file-conventions/
   * middleware, seção "Execution order") que `redirects()` deste
   * arquivo roda ANTES do middleware — não depois, como uma auditoria
   * anterior desta mesma fase tinha assumido por engano. Ordem real:
   * 1. headers (next.config.js); 2. redirects (next.config.js);
   * 3. Middleware; 4+. demais etapas. Ou seja: uma requisição que bate
   * neste redirect nunca chega a executar `middleware.ts`/
   * `updateSession()` (sem `supabase.auth.getUser()`) nem qualquer
   * `page.tsx`/`opengraph-image.tsx` por baixo — é a forma mais barata
   * possível de descontinuar a rota.
   *
   * `:path*` é "zero ou mais segmentos" (confirmado em nextjs.org/docs/
   * app/api-reference/config/next-config-js/redirects, seção "Wildcard
   * Path Matching" — mesmo exemplo oficial, `/blog/:slug*` casa com
   * `/blog/a/b/c/d/hello-world`), então "/u/:path*" cobre de uma vez só
   * "/u/usuario" (a página em si) E as rotas-irmãs geradas sob o mesmo
   * segmento — "/u/usuario/opengraph-image" (imagem OG) e as 4
   * sub-rotas "/u/usuario/favorite-movies|favorite-series|movies|
   * series" — sem precisar de uma entrada por URL.
   *
   * `permanent: true` (308) porque são links antigos que nunca vão
   * voltar a existir como perfil público — pedido explícito do
   * usuário ("redirecionamentos permanentes").
   *
   * FASE 6 (sublote 6C-5, 2026-10-22) — mesmo tratamento pra
   * "/r/[reviewId]" (review compartilhada): página + "opengraph-image"
   * + "story-image", todas sob o mesmo segmento "/r/:reviewId", cobertas
   * pelo mesmo "/r/:path*". Confirmado antes desta mudança que o
   * Sublote 6C-2 já removeu toda construção de URL "/r/..." do lado
   * mobile (reviewShareUrl/reviewShareImageUrl/reviewStoryImageUrl e o
   * SharePreviewSheet que os chamava não existem mais no disco real) —
   * ou seja, "/r/*" já não tem nenhum consumidor funcional em lugar
   * nenhum, web ou mobile, só links antigos já compartilhados no
   * passado.
   */
  async redirects() {
    return [
      {
        source: "/u/:path*",
        destination: "/download",
        permanent: true,
      },
      {
        source: "/r/:path*",
        destination: "/download",
        permanent: true,
      },
      /**
       * FASE 6 (sublote 6C-6, 2026-10-22) — descontinuação de
       * "/title/movie|series/[id]" (páginas públicas de filme/série).
       * Mesma lógica dos dois redirects acima: `redirects()` roda antes
       * do middleware, então zero chamada ao Supabase/TMDB por esta
       * URL a partir de agora. Diferença real confirmada por leitura do
       * código (não suposição): nenhuma das duas pastas tem
       * `opengraph-image.tsx`/arquivo-irmão — essas páginas usam o
       * pôster do TMDB direto via `openGraph.images`, não uma imagem
       * gerada — então um único "/title/:path*" (sem precisar separar
       * movie/series, confirmado por `device_list_dir` que não existe
       * nenhuma outra subrota sob "/title/" hoje) já cobre tudo, sem
       * risco de deixar uma rota-irmã de fora (diferente do cuidado que
       * "/u/"/"/r/" exigiram). Dependência mobile: zero — reconfirmado
       * por grep fresco em todo "apps/mobile" (nenhuma referência a
       * "/title/", nem na camada de dados: a página usa
       * `lib/tmdb/client.ts` e `lib/server/titlePublicContent.ts`,
       * exclusivos deste app web, nunca compartilhados com o mobile,
       * que tem seu próprio cliente TMDB via Edge Functions).
       */
      {
        source: "/title/:path*",
        destination: "/download",
        permanent: true,
      },
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "seenlist",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
