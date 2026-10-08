import { createAdminClient } from "@/lib/supabase/admin";
import { getMovieSummary, getSeriesSummary } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * A PEDIDO (2026-10-08 — "Compartilhamento social", Fase 1). Mesmo
 * padrão de `profileShareCard.ts` (ler esse arquivo primeiro — aqui
 * só os pontos que mudam estão comentados):
 *
 * - `createAdminClient` (ignora RLS) pelo mesmo motivo: quem chama é
 *   o CRAWLER de rede social gerando o preview do link, nunca uma
 *   sessão logada.
 * - A tabela `reviews` já é pública por padrão no banco (RLS só
 *   confere `deleted_at is null`, sem olhar visibilidade de perfil) —
 *   a visibilidade do AUTOR é replicada na mão aqui, igual ao perfil:
 *   review de autor com `profile_visibility !== 'public'` nunca
 *   aparece, mesma resposta de "não existe" (não revela "existe mas é
 *   privado").
 * - Diferente do perfil: review não tem pôster/título "snapshot"
 *   próprio (isso só existe quando ela também gera um Post no Feed,
 *   e essa integração foi removida do site — ver
 *   `ReviewTextSection.tsx`). Por isso busca o título/pôster da mídia
 *   AO VIVO no TMDB (`getMovieSummary`/`getSeriesSummary`, já usadas
 *   em `app/(main)/movies/[id]/comments/page.tsx`), em vez de
 *   `media_summaries_cache` — mais simples, sem depender de a mídia
 *   já ter sido cacheada por alguém, e o resultado desta rota já é
 *   cacheado por `revalidate` no `opengraph-image.tsx`.
 */

export interface ReviewShareCard {
  reviewId: string;
  mediaType: "movie" | "series";
  mediaId: number;
  mediaTitle: string;
  mediaPosterUrl: string | null;
  rating: number | null;
  reviewText: string | null;
  containsSpoiler: boolean;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    verifiedTier: "gold" | "blue" | null;
  };
}

const LANGUAGE = "pt-BR";

export async function fetchReviewShareCard(reviewId: string): Promise<ReviewShareCard | null> {
  const supabase = createAdminClient();

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id, user_id, media_type, media_id, rating, review_text, contains_spoiler, deleted_at")
    .eq("id", reviewId)
    .maybeSingle();

  if (reviewError) {
    console.error("[reviewShareCard] Falha ao buscar review", reviewError);
    return null;
  }
  if (!review || review.deleted_at !== null) return null;
  // Review "vazia" (só existe por humor/personagem favorito/onde assistiu, sem nota nem texto) não tem o que mostrar num card de compartilhamento.
  if (review.rating === null && !review.review_text) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, verified_tier, profile_visibility")
    .eq("user_id", review.user_id)
    .maybeSingle();

  if (profileError) {
    console.error("[reviewShareCard] Falha ao buscar autor", profileError);
    return null;
  }
  // Mesma regra do perfil: autor inexistente OU privado = mesma resposta de "não existe".
  if (!profile || profile.profile_visibility !== "public") return null;

  const mediaType = review.media_type as "movie" | "series";
  const mediaSummary = await (mediaType === "movie"
    ? getMovieSummary(review.media_id, LANGUAGE)
    : getSeriesSummary(review.media_id, LANGUAGE)
  ).catch((error) => {
    console.error("[reviewShareCard] Falha ao buscar resumo da mídia no TMDB", error);
    return null;
  });

  // Mídia não encontrada no TMDB (removida/id inválido) — card ainda é válido, só sem título/pôster, igual à degradação graciosa do perfil quando falta algo.
  const mediaTitle = mediaSummary?.title ?? "";
  const mediaPosterUrl = mediaSummary ? tmdbImage(mediaSummary.posterPath, "w500") : null;

  return {
    reviewId: review.id,
    mediaType,
    mediaId: review.media_id,
    mediaTitle,
    mediaPosterUrl,
    rating: review.rating === null ? null : Number(review.rating),
    reviewText: review.review_text,
    containsSpoiler: review.contains_spoiler,
    author: {
      username: profile.username,
      displayName: profile.display_name ?? profile.username,
      avatarUrl: profile.avatar_url,
      verifiedTier: profile.verified_tier,
    },
  };
}
