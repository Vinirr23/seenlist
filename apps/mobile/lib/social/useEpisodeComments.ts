import { useCallback, useEffect, useState } from "react";
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
 * CORREÇÃO (a pedido — mesma mudança já aplicada no web, "quero um
 * aviso antes de entrar") — `useEpisodeSpoilerProtection` (oclusão
 * automática por progresso, comentário por comentário) foi removida.
 * Virou um aviso único, antes de entrar na tela de Comentários (o
 * botão "Comentário" na tela do episódio pergunta antes de navegar,
 * ver `app/episodes/[seriesId]/[season]/[episode].tsx`).
 */

export function useEpisodeComments(target: MediaTarget) {
  const [tree, setTree] = useState<CommentNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // CORREÇÃO (Fase 3, achado alto — mesmo bug de `useDiscoverList.ts`) —
  // antes, uma falha de rede caía direto no `console.error` e a tela
  // renderizava a mesma coisa de "nenhum comentário ainda", sem
  // diferenciar as duas situações. `isError` some de novo assim que
  // `load()` (retry) tiver sucesso.
  const [isError, setIsError] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const comments = await fetchMediaComments(target);
      setTree(buildCommentTree(comments));
    } catch (error) {
      console.error("[useEpisodeComments] Falha ao buscar comentários", error);
      setIsError(true);
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

  return { tree, isLoading, isError, sending, submit, remove, edit, retry: load };
}
