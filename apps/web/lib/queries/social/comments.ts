import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { useToast } from "@/lib/toast/ToastProvider";
import type { MediaTarget } from "./types";

export interface CommentAuthor {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Comment {
  id: string;
  parentCommentId: string | null;
  /** TASK-065 — nulo quando o comentário é só imagem/GIF, sem legenda. */
  body: string | null;
  /** TASK-065 — imagem ou GIF anexado ao comentário (mesma coluna serve pros dois). Nulo quando o comentário é só texto. */
  imageUrl: string | null;
  containsSpoiler: boolean;
  createdAt: string;
  updatedAt: string;
  author: CommentAuthor;
}

function commentsQueryKey(target: MediaTarget) {
  return [
    "comments",
    target.mediaType,
    target.mediaId,
    target.seasonNumber ?? null,
    target.episodeNumber ?? null,
  ] as const;
}

/**
 * TASK-052 — "Comentários    82 >" (linha só, sem abrir a árvore
 * inteira). `count: "exact", head: true` não baixa nenhuma linha, só
 * o total — mais barato que `useComments` pra quem só quer o número.
 */
export function useCommentCount(target: MediaTarget) {
  return useQuery({
    queryKey: [...commentsQueryKey(target), "count"],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from("comments")
        .select("*", { count: "exact", head: true })
        .eq("media_type", target.mediaType)
        .eq("media_id", target.mediaId)
        .is("deleted_at", null);

      query =
        target.seasonNumber != null
          ? query.eq("season_number", target.seasonNumber)
          : query.is("season_number", null);
      query =
        target.episodeNumber != null
          ? query.eq("episode_number", target.episodeNumber)
          : query.is("episode_number", null);

      const { count, error } = await query;
      if (error) {
        console.error("[social/comments] Falha ao buscar contagem de comentários", describeSupabaseError(error));
        throw error;
      }
      return count ?? 0;
    },
  });
}

/**
 * TASK-031 — uma consulta só, filtrando pelas mesmas 4 colunas em
 * toda tabela do schema novo (media_type, media_id, season_number,
 * episode_number) — funciona idêntico pra filme, série, temporada ou
 * episódio, só muda o que é passado em `target`. `profiles` é
 * juntada aqui pra já vir com autor pronto (nome/avatar), evitando
 * uma consulta por comentário na tela.
 */
/**
 * TASK-031 — duas consultas, não uma com "join embutido" do
 * PostgREST (`profiles(...)`). `comments.user_id` e
 * `profiles.user_id` referenciam `auth.users` cada um por si — não
 * existe FK direta entre `comments` e `profiles`, e o PostgREST só
 * infere embedding automático quando há uma FK explícita entre as
 * duas tabelas envolvidas. Buscar os perfis à parte e juntar no
 * cliente é mais lento em teoria (2 consultas), mas correto de
 * verdade — evita depender de uma inferência que pode simplesmente
 * não funcionar.
 */
export function useComments(target: MediaTarget) {
  return useQuery({
    queryKey: commentsQueryKey(target),
    queryFn: async (): Promise<Comment[]> => {
      const supabase = createClient();
      let query = supabase
        .from("comments")
        .select("id, parent_comment_id, body, image_url, contains_spoiler, created_at, updated_at, user_id")
        .eq("media_type", target.mediaType)
        .eq("media_id", target.mediaId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      query =
        target.seasonNumber == null ? query.is("season_number", null) : query.eq("season_number", target.seasonNumber);
      query =
        target.episodeNumber == null
          ? query.is("episode_number", null)
          : query.eq("episode_number", target.episodeNumber);

      const { data, error } = await query;
      if (error) {
        console.error("[social/comments] Falha ao buscar comentários", describeSupabaseError(error));
        throw error;
      }

      const rows = data ?? [];
      const userIds = [...new Set(rows.map((row) => row.user_id))];
      const profilesById = new Map<string, CommentAuthor>();
      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, username, display_name, avatar_url")
          .in("user_id", userIds);
        if (profileError) {
          console.error("[social/comments] Falha ao buscar autores dos comentários", describeSupabaseError(profileError));
        } else {
          for (const p of profileRows ?? []) {
            profilesById.set(p.user_id, {
              userId: p.user_id,
              username: p.username,
              displayName: p.display_name,
              avatarUrl: p.avatar_url,
            });
          }
        }
      }

      return rows.map((row) => ({
        id: row.id,
        parentCommentId: row.parent_comment_id,
        body: row.body,
        imageUrl: row.image_url,
        containsSpoiler: row.contains_spoiler,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        author: profilesById.get(row.user_id) ?? {
          userId: row.user_id,
          username: "usuário",
          displayName: null,
          avatarUrl: null,
        },
      }));
    },
  });
}

export function usePostComment(target: MediaTarget) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      body,
      imageUrl,
      parentCommentId,
      containsSpoiler,
    }: {
      body: string;
      imageUrl?: string | null;
      parentCommentId?: string | null;
      containsSpoiler?: boolean;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await getCurrentAuthUser(supabase);
      if (!user) throw new Error("not authenticated");

      const { error } = await supabase.from("comments").insert({
        user_id: user.id,
        media_type: target.mediaType,
        media_id: target.mediaId,
        season_number: target.seasonNumber ?? null,
        episode_number: target.episodeNumber ?? null,
        parent_comment_id: parentCommentId ?? null,
        body: body.trim() ? body : null,
        image_url: imageUrl ?? null,
        contains_spoiler: containsSpoiler ?? false,
      });
      if (error) {
        console.error("[social/comments] Falha ao publicar comentário", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(target) });
    },
    onError: () => {
      toast.error("Não foi possível publicar o comentário agora");
    },
  });
}

/**
 * TASK-048 — faltava editar (só existia publicar + soft-delete). RLS
 * já restringe update à própria linha (`auth.uid() = user_id`,
 * TASK-031) — o UPDATE aqui só falha sozinho se tentarem editar
 * comentário de outra pessoa, sem precisar checar nada a mais aqui.
 */
export function useEditComment(target: MediaTarget) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      commentId,
      body,
      imageUrl,
      containsSpoiler,
    }: {
      commentId: string;
      body: string;
      imageUrl?: string | null;
      containsSpoiler?: boolean;
    }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("comments")
        .update({
          body: body.trim() ? body : null,
          image_url: imageUrl ?? null,
          contains_spoiler: containsSpoiler ?? false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commentId);
      if (error) {
        console.error("[social/comments] Falha ao editar comentário", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(target) });
      toast.success("Comentário editado");
    },
    onError: () => {
      toast.error("Não foi possível editar o comentário agora");
    },
  });
}

export function useDeleteComment(target: MediaTarget) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (commentId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("comments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", commentId);
      if (error) {
        console.error("[social/comments] Falha ao remover comentário", describeSupabaseError(error));
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey(target) });
      toast.success("Comentário removido");
    },
    onError: () => {
      toast.error("Não foi possível remover o comentário agora");
    },
  });
}