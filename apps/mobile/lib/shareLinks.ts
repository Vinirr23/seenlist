/**
 * A PEDIDO (2026-10-08 — "Compartilhamento social", Fase 1). Helper
 * central só pros links NOVOS de compartilhamento criados por esta
 * feature (perfil, review) — NÃO toca nos usos já existentes de
 * `SITE_URL` espalhados pelo app (chamadas internas de API
 * TMDB-proxy, sem relação com compartilhamento; ver
 * `lib/library.ts`/`lib/movieDetails.ts`/etc.). O link de perfil já
 * era montado por literal direto em `ProfileMoreSheet.tsx`
 * (`https://seenlist.app/u/${username}`) — este arquivo só dá um nome
 * reaproveitável pra esse mesmo literal, sem mudar o domínio nem o
 * formato.
 *
 * A PEDIDO (2026-10-08, extensão — tela de prévia antes de
 * compartilhar, item 3 do pedido): `reviewShareImageUrl`/
 * `postShareImageUrl` apontam pra rota de imagem gerada por
 * `opengraph-image.tsx` (mesmo arquivo que o Next.js já serve
 * nessa URL, por convenção de arquivo) — é a MESMA imagem que
 * aparece na prévia do Threads/WhatsApp, usada aqui só pra mostrar
 * dentro do app, no `SharePreviewSheet`. `postShareUrl` idem
 * `reviewShareUrl`, pra post publicado no Feed.
 *
 * A PEDIDO (2026-10-08, redesign "estilo Unwind" — mockup aprovado em
 * https://claude.ai/artifact/SvYnmVJedKZkRjvXNHbsdm): `reviewStoryImageUrl`
 * aponta pra `apps/web/app/r/[reviewId]/story-image/route.ts` — uma rota
 * comum (NÃO a convenção `opengraph-image.tsx`), porque esta imagem
 * (vertical, 1080×1920) nunca deve virar o `og:image` do link — ela só
 * existe pra ação explícita "Exportar pra Stories" dentro do app.
 */

const SEENLIST_WEB_ORIGIN = "https://seenlist.app";

export function profileShareUrl(username: string): string {
  return `${SEENLIST_WEB_ORIGIN}/u/${username}`;
}

export function reviewShareUrl(reviewId: string): string {
  return `${SEENLIST_WEB_ORIGIN}/r/${reviewId}`;
}

export function reviewShareImageUrl(reviewId: string): string {
  return `${SEENLIST_WEB_ORIGIN}/r/${reviewId}/opengraph-image`;
}

export function reviewStoryImageUrl(reviewId: string): string {
  return `${SEENLIST_WEB_ORIGIN}/r/${reviewId}/story-image`;
}

export function postShareUrl(postId: string): string {
  return `${SEENLIST_WEB_ORIGIN}/explore/posts/${postId}`;
}

export function postShareImageUrl(postId: string): string {
  return `${SEENLIST_WEB_ORIGIN}/explore/posts/${postId}/opengraph-image`;
}
