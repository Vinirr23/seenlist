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
 */

const SEENLIST_WEB_ORIGIN = "https://seenlist.app";

export function profileShareUrl(username: string): string {
  return `${SEENLIST_WEB_ORIGIN}/u/${username}`;
}

export function reviewShareUrl(reviewId: string): string {
  return `${SEENLIST_WEB_ORIGIN}/r/${reviewId}`;
}
