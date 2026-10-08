import { createAdminClient } from "@/lib/supabase/admin";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * A PEDIDO (2026-10-08, "Compartilhamento social" — extensão pedida
 * depois de testar a Fase 1: "ao compartilhar uma avaliação publicada
 * no Feed, o link /explore/posts/[id] aparece sem prévia visual
 * personalizada"). Mesmo padrão de `reviewShareCard.ts` (ler aquele
 * arquivo primeiro — aqui só os pontos que mudam estão comentados):
 *
 * - Só post do tipo "review" (`posts.type === 'review'`) ganha card
 *   personalizado — é o único tipo com mídia/nota anexada. Post de
 *   texto/imagem/enquete continua sem OG próprio (comportamento já
 *   existente, nunca teve e não foi pedido agora).
 * - Diferente de review: `posts` não tem `media_poster_path`/`media_title`
 *   "ao vivo" — já é um SNAPSHOT tirado no momento da publicação (ver
 *   `useCreatePost`/`usePublishReviewToFeed`, `lib/queries/posts.ts`),
 *   então não precisa buscar no TMDB de novo, só montar a URL da
 *   imagem a partir do path já salvo.
 * - `posts` não tem coluna `contains_spoiler` (só `reviews` tem) — o
 *   texto do post (`body`) não tem como ser spoiler-gated aqui; mesma
 *   limitação que já existe no próprio Feed (o `PostCard.tsx` também
 *   mostra o texto do post sempre, sem esconder nada).
 */

export interface PostShareCard {
  postId: string;
  mediaType: "movie" | "series" | null;
  mediaId: number | null;
  mediaTitle: string | null;
  mediaPosterUrl: string | null;
  rating: number | null;
  body: string;
  author: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    verifiedTier: "gold" | "blue" | null;
  };
}

export async function fetchPostShareCard(postId: string): Promise<PostShareCard | null> {
  const supabase = createAdminClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, user_id, type, body, media_type, media_id, media_title, media_poster_path, rating, deleted_at")
    .eq("id", postId)
    .maybeSingle();

  if (postError) {
    console.error("[postShareCard] Falha ao buscar post", postError);
    return null;
  }
  if (!post || post.deleted_at !== null || post.type !== "review") return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("username, display_name, avatar_url, verified_tier, profile_visibility")
    .eq("user_id", post.user_id)
    .maybeSingle();

  if (profileError) {
    console.error("[postShareCard] Falha ao buscar autor", profileError);
    return null;
  }
  // Mesma regra do perfil/review: autor inexistente OU privado = mesma resposta de "não existe".
  if (!profile || profile.profile_visibility !== "public") return null;

  return {
    postId: post.id,
    mediaType: post.media_type,
    mediaId: post.media_id,
    mediaTitle: post.media_title,
    mediaPosterUrl: tmdbImage(post.media_poster_path, "w500"),
    rating: post.rating === null ? null : Number(post.rating),
    body: post.body ?? "",
    author: {
      username: profile.username,
      displayName: profile.display_name ?? profile.username,
      avatarUrl: profile.avatar_url,
      verifiedTier: profile.verified_tier,
    },
  };
}
