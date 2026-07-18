import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { useToast } from "@/lib/toast/ToastProvider";
import type { MediaTarget } from "./types";

export interface Review {
  id: string;
  userId: string;
  /** TASK-067 — nulo quando a linha existe só por causa de humor/personagem favorito/onde assistiu, sem nota ainda. */
  rating: number | null;
  reviewText: string | null;
  containsSpoiler: boolean;
  /** TASK-173 (antes: string única) — múltipla escolha, array de key. Reação pós-"assistido", estilo TV Time. Todos opcionais — nada disso é exigido pra salvar uma nota. */
  mood: string[];
  favoriteCharacterId: number | null;
  favoriteCharacterName: string | null;
  watchedPlatform: string | null;
  createdAt: string;
  updatedAt: string;
  author: { username: string; displayName: string | null; avatarUrl: string | null };
}

function reviewsQueryKey(target: MediaTarget) {
  return [
    "reviews",
    target.mediaType,
    target.mediaId,
    target.seasonNumber ?? null,
    target.episodeNumber ?? null,
  ] as const;
}
function myReviewQueryKey(target: MediaTarget) {
  return [...reviewsQueryKey(target), "mine"] as const;
}

export interface ReviewAggregate {
  average: number | null;
  count: number;
}

/**
 * TASK-056 — "Avaliação da comunidade SeenList". Só busca a coluna
 * `rating` (não a linha inteira) pra calcular média/contagem no
 * cliente — sem RPC nova, sem SQL novo, reaproveitando a mesma
 * tabela `reviews` (Opção A da comparação).
 */
export function useReviewAggregate(target: MediaTarget) {
  return useQuery({
    queryKey: [...reviewsQueryKey(target), "aggregate"],
    queryFn: async (): Promise<ReviewAggregate> => {
      const supabase = createClient();
      let query = supabase
        .from("reviews")
        .select("rating")
        .eq("media_type", target.mediaType)
        .eq("media_id", target.mediaId)
        .is("deleted_at", null)
        .not("rating", "is", null);

      query =
        target.seasonNumber == null
          ? query.is("season_number", null)
          : query.eq("season_number", target.seasonNumber);
      query =
        target.episodeNumber == null
          ? query.is("episode_number", null)
          : query.eq("episode_number", target.episodeNumber);

      const { data, error } = await query;
      if (error) {
        console.error("[social/reviews] Falha ao buscar agregado de avaliações", describeSupabaseError(error));
        throw error;
      }

      const ratings = (data ?? []).map((row) => row.rating as number);
      if (ratings.length === 0) return { average: null, count: 0 };
      const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
      return { average, count: ratings.length };
    },
  });
}

/** Mesmo motivo de comments.ts: duas consultas, não embedding do PostgREST (sem FK direta entre reviews e profiles). */
export function useReviews(target: MediaTarget) {
  return useQuery({
    queryKey: reviewsQueryKey(target),
    queryFn: async (): Promise<Review[]> => {
      const supabase = createClient();
      let query = supabase
        .from("reviews")
        .select("id, user_id, rating, review_text, contains_spoiler, created_at, updated_at")
        .eq("media_type", target.mediaType)
        .eq("media_id", target.mediaId)
        .or("rating.not.is.null,review_text.not.is.null")
        .order("created_at", { ascending: false });

      query =
        target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
      query =
        target.episodeNumber == null
          ? query.is("episode_number", null)
          : query.eq("episode_number", target.episodeNumber);

      const { data, error } = await query;
      if (error) {
        console.error("[social/reviews] Falha ao buscar reviews", describeSupabaseError(error));
        throw error;
      }

      const rows = data ?? [];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const profilesById = new Map<string, { username: string; displayName: string | null; avatarUrl: string | null }>();
      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds);
        if (profileError) {
          console.error("[social/reviews] Falha ao buscar autores das reviews", describeSupabaseError(profileError));
        } else {
          for (const p of profileRows ?? []) {
            profilesById.set(p.user_id, { username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url });
          }
        }
      }

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        rating: row.rating === null ? null : Number(row.rating),
        reviewText: row.review_text,
        containsSpoiler: row.contains_spoiler,
        mood: [],
        favoriteCharacterId: null,
        favoriteCharacterName: null,
        watchedPlatform: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: profilesById.get(row.user_id) ?? { username: "usuário", displayName: null, avatarUrl: null },
      }));
    },
  });
}

/** "Usuários podem editar" pressupõe saber qual é a própria review pra pré-preencher o formulário — é o que esta consulta resolve. */
export function useMyReview(target: MediaTarget) {
  return useQuery({
    queryKey: myReviewQueryKey(target),
    queryFn: async (): Promise<Review | null> => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) return null;

      let query = supabase
        .from("reviews")
        .select(
          "id, user_id, rating, review_text, contains_spoiler, mood, favorite_character_id, favorite_character_name, watched_platform, created_at, updated_at"
        )
        .eq("user_id", user.id)
        .eq("media_type", target.mediaType)
        .eq("media_id", target.mediaId);

      query =
        target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
      query =
        target.episodeNumber == null
          ? query.is("episode_number", null)
          : query.eq("episode_number", target.episodeNumber);

      const { data, error } = await query.maybeSingle();
      if (error) {
        console.error("[social/reviews] Falha ao buscar a própria review", describeSupabaseError(error));
        throw error;
      }
      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        rating: Number(data.rating),
        reviewText: data.review_text,
        containsSpoiler: data.contains_spoiler,
        mood: data.mood ?? [],
        favoriteCharacterId: data.favorite_character_id,
        favoriteCharacterName: data.favorite_character_name,
        watchedPlatform: data.watched_platform,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        author: { username: "", displayName: null, avatarUrl: null },
      };
    },
  });
}

/**
 * Upsert pela constraint única (user_id, media_type, media_id,
 * season_number, episode_number) — "avaliação rápida" e "editar
 * review" são a mesma operação.
 *
 * TASK-067 — `mood`/`favoriteCharacterId`/`favoriteCharacterName`/
 * `watchedPlatform` são opcionais e só entram no payload quando
 * explicitamente passados (`!== undefined`) — cada pedacinho da
 * experiência pós-"assistido" (onde assistiu, nota, humor,
 * personagem favorito) chama esta mesma mutation separadamente,
 * conforme a pessoa vai preenchendo; se todos os campos fossem
 * sempre enviados, preencher só o "humor" apagaria a nota que já
 * tinha sido salva antes (upsert do PostgREST só preserva colunas
 * que o payload não menciona).
 */
export function useUpsertReview(target: MediaTarget) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      rating,
      reviewText,
      containsSpoiler,
      mood,
      favoriteCharacterId,
      favoriteCharacterName,
      watchedPlatform,
    }: {
      rating?: number;
      reviewText?: string | null;
      containsSpoiler?: boolean;
      mood?: string[] | null;
      favoriteCharacterId?: number | null;
      favoriteCharacterName?: string | null;
      watchedPlatform?: string | null;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const payload: Record<string, unknown> = {
        user_id: user.id,
        media_type: target.mediaType,
        media_id: target.mediaId,
        season_number: target.seasonNumber ?? null,
        episode_number: target.episodeNumber ?? null,
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };
      if (rating !== undefined) payload.rating = rating;
      if (reviewText !== undefined) payload.review_text = reviewText;
      if (containsSpoiler !== undefined) payload.contains_spoiler = containsSpoiler;
      if (mood !== undefined) payload.mood = mood;
      if (favoriteCharacterId !== undefined) payload.favorite_character_id = favoriteCharacterId;
      if (favoriteCharacterName !== undefined) payload.favorite_character_name = favoriteCharacterName;
      if (watchedPlatform !== undefined) payload.watched_platform = watchedPlatform;

      const { error } = await supabase
        .from("reviews")
        .upsert(payload, { onConflict: "user_id,media_type,media_id,season_number,episode_number" });
      if (error) {
        console.error("[social/reviews] Falha ao salvar review", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: reviewsQueryKey(target) });
      queryClient.invalidateQueries({ queryKey: myReviewQueryKey(target) });
      // TASK-067 — só mostra o toast "Avaliação salva" pra nota (rating); os outros campos têm seu próprio feedback visual (seleção destacada), um toast por toque em emoji/personagem seria barulho.
      if (variables.rating !== undefined) toast.success("Avaliação salva");
    },
    onError: () => {
      toast.error("Não foi possível salvar a avaliação agora");
    },
  });
}

export function useDeleteReview(target: MediaTarget) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (reviewId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("reviews")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", reviewId);
      if (error) {
        console.error("[social/reviews] Falha ao remover review", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewsQueryKey(target) });
      queryClient.invalidateQueries({ queryKey: myReviewQueryKey(target) });
      toast.success("Avaliação removida");
    },
    onError: () => {
      toast.error("Não foi possível remover a avaliação agora");
    },
  });
}
