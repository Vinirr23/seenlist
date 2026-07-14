import { useCallback, useEffect, useState } from "react";
import { isEpisodeWatched } from "@/lib/seriesDetails";
import {
  buildCommentTree,
  deleteMediaComment,
  editMediaComment,
  fetchMediaCommentCount,
  fetchMediaComments,
  postMediaComment,
  type CommentNode,
  type MediaTarget,
} from "./mediaComments";

export function useEpisodeCommentCount(target: MediaTarget) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchMediaCommentCount(target).then((value) => {
      if (!cancelled) setCount(value);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.mediaId, target.seasonNumber, target.episodeNumber]);

  return count;
}

/**
 * TASK-122 (episódio) — porta de `useSpoilerProtection`: "assistiu
 * até o episódio 5, abre o episódio 9" → oculta por padrão, porque
 * não assistiu ESTE episódio específico ainda (não precisa
 * reconstruir ordem cronológica, só checar se este episódio já foi
 * marcado). Reaproveita `isEpisodeWatched`, já existente desde a
 * correção do bug de categoria presa.
 */
export function useEpisodeSpoilerProtection(seriesId: number, seasonNumber: number, episodeNumber: number) {
  const [shouldHideByDefault, setShouldHideByDefault] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isEpisodeWatched(seriesId, seasonNumber, episodeNumber).then((watched) => {
      if (!cancelled) setShouldHideByDefault(!watched);
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId, seasonNumber, episodeNumber]);

  return shouldHideByDefault;
}

export function useEpisodeComments(target: MediaTarget) {
  const [tree, setTree] = useState<CommentNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const comments = await fetchMediaComments(target);
      setTree(buildCommentTree(comments));
    } catch (error) {
      console.error("[useEpisodeComments] Falha ao buscar comentários", error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.mediaId, target.seasonNumber, target.episodeNumber]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(
    async (body: string, containsSpoiler: boolean, parentCommentId: string | null, imageUrl: string | null = null) => {
      setSending(true);
      try {
        await postMediaComment(target, body, containsSpoiler, parentCommentId, imageUrl);
        await load();
        return true;
      } catch (error) {
        console.error("[useEpisodeComments] Falha ao comentar", error);
        return false;
      } finally {
        setSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target.mediaId, target.seasonNumber, target.episodeNumber, load]
  );

  const remove = useCallback(
    async (commentId: string) => {
      await deleteMediaComment(commentId);
      await load();
    },
    [load]
  );

  const edit = useCallback(
    async (commentId: string, body: string) => {
      await editMediaComment(commentId, body);
      await load();
    },
    [load]
  );

  return { tree, isLoading, sending, submit, remove, edit };
}
