import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { useToast } from "@/lib/toast/ToastProvider";
import type { MediaTarget } from "./types";

export interface Review {
  id: string;
  userId: string;
  rating: number;
  reviewText: string | null;
  containsSpoiler: boolean;
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
        .is("deleted_at", null);

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
        rating: Number(row.rating),
        reviewText: row.review_text,
        containsSpoiler: row.contains_spoiler,
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
      } = await supabase.auth.getUser();
      if (!user) return null;

      let query = supabase
        .from("reviews")
        .select("id, user_id, rating, review_text, contains_spoiler, created_at, updated_at")
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
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        author: { username: "", displayName: null, avatarUrl: null },
      };
    },
  });
}

/** Upsert pela constraint única (user_id, media_type, media_id, season_number, episode_number) — "avaliação rápida" e "editar review" são a mesma operação. */
export function useUpsertReview(target: MediaTarget) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      rating,
      reviewText,
      containsSpoiler,
    }: {
      rating: number;
      reviewText?: string | null;
      containsSpoiler?: boolean;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("reviews").upsert(
        {
          user_id: user.id,
          media_type: target.mediaType,
          media_id: target.mediaId,
          season_number: target.seasonNumber ?? null,
          episode_number: target.episodeNumber ?? null,
          rating,
          review_text: reviewText ?? null,
          contains_spoiler: containsSpoiler ?? false,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        { onConflict: "user_id,media_type,media_id,season_number,episode_number" }
      );
      if (error) {
        console.error("[social/reviews] Falha ao salvar review", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reviewsQueryKey(target) });
      queryClient.invalidateQueries({ queryKey: myReviewQueryKey(target) });
      toast.success("Avaliação salva");
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
