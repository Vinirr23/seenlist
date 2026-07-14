import type { LibraryItem } from "@seenlist/types";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";
import { fetchDisplaySummaries, fetchLibraryItems, type MediaSummary } from "@/lib/library";

export type ProfileVisibility = "public" | "followers" | "private";

export interface UserProfile {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  bannerUrl: string | null;
  country: string | null;
  createdAt: string;
}

interface ProfileRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  country: string | null;
  created_at: string;
}

function fromRow(row: ProfileRow): UserProfile {
  return {
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    bannerUrl: row.banner_url,
    country: row.country,
    createdAt: row.created_at,
  };
}

/**
 * TASK-103 (Perfil público) — porta de `usePublicProfile`. `null`
 * cobre tanto "não existe" quanto "existe mas é privado" de
 * propósito (a RLS já filtra isso) — a tela trata os dois casos com
 * a mesma mensagem, não revela qual dos dois é.
 */
export async function fetchPublicProfile(username: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from("profiles").select("*").ilike("username", username).maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ProfileRow) : null;
}

export async function fetchFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followers, following] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function fetchFollowStatus(targetUserId: string): Promise<boolean> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** "Não implementar notificações — só o relacionamento entre usuários" (mesma nota do web): insere/remove uma linha em `follows`, só isso. */
export async function toggleFollow(targetUserId: string, currentlyFollowing: boolean): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentlyFollowing) {
    const { error } = await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetUserId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("follows").insert({ follower_id: user.id, following_id: targetUserId });
    if (error) throw error;
  }
}

interface FavoriteRow {
  media_type: "movie" | "series";
  media_id: number;
}

/**
 * Porta de `usePublicFavorites` (favorites.ts) — mesmo padrão de
 * `fetchLibraryItems`: busca os favoritos brutos, decora com
 * poster/título via `fetchDisplaySummaries` (a mesma função já usada
 * pela Biblioteca, reaproveitada — nenhuma integração nova com o
 * TMDB). `status: "completed"` é só um valor de exibição (o
 * `PosterGrid` não mostra barra de progresso pra favoritos de
 * qualquer forma) — mesma escolha do web.
 */
export async function fetchPublicFavorites(userId: string): Promise<LibraryItem[]> {
  const { data, error } = await supabase.from("favorites").select("media_type, media_id").eq("user_id", userId);
  if (error) throw error;

  const rows = (data ?? []) as FavoriteRow[];
  const movieIds = rows.filter((r) => r.media_type === "movie").map((r) => r.media_id);
  const seriesIds = rows.filter((r) => r.media_type === "series").map((r) => r.media_id);
  if (movieIds.length === 0 && seriesIds.length === 0) return [];

  const summaries = await fetchDisplaySummaries(movieIds, seriesIds);
  const now = new Date().toISOString();

  const toItem = (mediaType: "movie" | "series") => (summary: MediaSummary): LibraryItem => ({
    mediaType,
    id: summary.id,
    status: "completed",
    createdAt: now,
    updatedAt: now,
    title: summary.title,
    year: summary.year,
    posterPath: summary.posterPath,
  });

  return [...Object.values(summaries.movies).map(toItem("movie")), ...Object.values(summaries.series).map(toItem("series"))];
}

/** Biblioteca pública de outro usuário — mesma função de sempre, só passando o userId do dono do perfil em vez do usuário logado. */
export async function fetchPublicLibraryItems(userId: string): Promise<LibraryItem[]> {
  return fetchLibraryItems(userId);
}
