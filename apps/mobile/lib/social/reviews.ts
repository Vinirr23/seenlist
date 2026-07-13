import { supabase } from "@/lib/supabase";

export type ReviewMediaType = "movie" | "series";

export interface ReviewTarget {
  mediaType: ReviewMediaType;
  mediaId: number;
  /** TASK-115 (episódio) — generalização do alvo: sem os dois, é review de série/filme inteiro; com os dois, é review de UM episódio. */
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface Review {
  id: string;
  userId: string;
  rating: number | null;
  reviewText: string | null;
  containsSpoiler: boolean;
  mood: string | null;
  watchedPlatform: string | null;
  createdAt: string;
  author: { username: string; displayName: string | null; avatarUrl: string | null };
}

interface ReviewRow {
  id: string;
  user_id: string;
  rating: number | string | null;
  review_text: string | null;
  contains_spoiler: boolean;
  mood: string | null;
  watched_platform: string | null;
  created_at: string;
}

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * TASK-101/115 (Avaliações) — porta de `lib/queries/social/reviews.ts`.
 * Generalizado (TASK-115) pra também servir review de EPISÓDIO —
 * inicialmente só cobria série/filme inteiros. Duas consultas
 * (reviews + profiles) em vez de embedding do PostgREST: não existe
 * FK direta entre `reviews` e `profiles`.
 */
export async function fetchReviews(target: ReviewTarget): Promise<Review[]> {
  let query = supabase
    .from("reviews")
    .select("id, user_id, rating, review_text, contains_spoiler, mood, watched_platform, created_at")
    .eq("media_type", target.mediaType)
    .eq("media_id", target.mediaId)
    .is("deleted_at", null)
    .or("rating.not.is.null,review_text.not.is.null");
  query = target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
  query = target.episodeNumber == null ? query.is("episode_number", null) : query.eq("episode_number", target.episodeNumber);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as ReviewRow[];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const profilesById = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id, username, display_name, avatar_url")
      .in("user_id", userIds);
    for (const p of (profileRows ?? []) as ProfileRow[]) profilesById.set(p.user_id, p);
  }

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      rating: row.rating === null ? null : Number(row.rating),
      reviewText: row.review_text,
      containsSpoiler: row.contains_spoiler,
      mood: row.mood,
      watchedPlatform: row.watched_platform,
      createdAt: row.created_at,
      author: {
        username: profile?.username ?? "usuário",
        displayName: profile?.display_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      },
    };
  });
}

export async function fetchMyReview(target: ReviewTarget): Promise<Review | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from("reviews")
    .select("id, user_id, rating, review_text, contains_spoiler, mood, watched_platform, created_at")
    .eq("user_id", user.id)
    .eq("media_type", target.mediaType)
    .eq("media_id", target.mediaId)
    .is("deleted_at", null);
  query = target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
  query = target.episodeNumber == null ? query.is("episode_number", null) : query.eq("episode_number", target.episodeNumber);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as ReviewRow;
  return {
    id: row.id,
    userId: row.user_id,
    rating: row.rating === null ? null : Number(row.rating),
    reviewText: row.review_text,
    containsSpoiler: row.contains_spoiler,
    mood: row.mood,
    watchedPlatform: row.watched_platform,
    createdAt: row.created_at,
    author: { username: "", displayName: null, avatarUrl: null },
  };
}

export interface ReviewAggregate {
  average: number | null;
  count: number;
}

/**
 * TASK-115 (episódio) — "Avaliação da comunidade SeenList" — só
 * busca a coluna `rating` (não a linha inteira) pra calcular média/
 * contagem no cliente, mesma ideia do web (TASK-056).
 */
export async function fetchReviewAggregate(target: ReviewTarget): Promise<ReviewAggregate> {
  let query = supabase
    .from("reviews")
    .select("rating")
    .eq("media_type", target.mediaType)
    .eq("media_id", target.mediaId)
    .is("deleted_at", null)
    .not("rating", "is", null);
  query = target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
  query = target.episodeNumber == null ? query.is("episode_number", null) : query.eq("episode_number", target.episodeNumber);
  const { data, error } = await query;
  if (error) throw error;

  const ratings = (data ?? []).map((row) => Number(row.rating));
  if (ratings.length === 0) return { average: null, count: 0 };
  const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  return { average, count: ratings.length };
}

/**
 * Upsert pela constraint única (user_id, media_type, media_id,
 * season_number, episode_number) — mesma operação salva ou edita.
 * TASK-115 — campos passam a ser todos opcionais (só entram no
 * payload quando `!== undefined`): a experiência pós-"assistido" do
 * episódio salva nota/humor/plataforma em toques separados, cada um
 * uma chamada; se todos os campos fossem sempre enviados, preencher
 * só o "humor" apagaria a nota que já tinha sido salva antes.
 */
export async function upsertReview(
  target: ReviewTarget,
  payload: { rating?: number; reviewText?: string | null; containsSpoiler?: boolean; mood?: string | null; watchedPlatform?: string | null }
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const row: Record<string, unknown> = {
    user_id: user.id,
    media_type: target.mediaType,
    media_id: target.mediaId,
    season_number: target.seasonNumber ?? null,
    episode_number: target.episodeNumber ?? null,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  };
  if (payload.rating !== undefined) row.rating = payload.rating;
  if (payload.reviewText !== undefined) row.review_text = payload.reviewText;
  if (payload.containsSpoiler !== undefined) row.contains_spoiler = payload.containsSpoiler;
  if (payload.mood !== undefined) row.mood = payload.mood;
  if (payload.watchedPlatform !== undefined) row.watched_platform = payload.watchedPlatform;

  const { error } = await supabase.from("reviews").upsert(row, { onConflict: "user_id,media_type,media_id,season_number,episode_number" });
  if (error) throw error;
}

export async function deleteReview(reviewId: string): Promise<void> {
  const { error } = await supabase.from("reviews").update({ deleted_at: new Date().toISOString() }).eq("id", reviewId);
  if (error) throw error;
}
