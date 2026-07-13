import { useCallback, useEffect, useState } from "react";
import type { Post } from "./posts";
import { fetchPost } from "./posts";
import { buildPostCommentTree, createPostComment, fetchPostComments, type CommentNode } from "./postComments";

export function usePost(postId: string) {
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPost(postId)
      .then((data) => {
        if (!cancelled) setPost(data);
      })
      .catch((error) => {
        console.error("[usePost] Falha ao buscar post", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  return { post, isLoading, isError };
}

export function usePostComments(postId: string) {
  const [tree, setTree] = useState<CommentNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const comments = await fetchPostComments(postId);
      setTree(buildPostCommentTree(comments));
    } catch (error) {
      console.error("[usePostComments] Falha ao buscar comentários", error);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(
    async (body: string, parentCommentId: string | null) => {
      setSending(true);
      try {
        await createPostComment(postId, body, parentCommentId);
        await load();
        return true;
      } catch (error) {
        console.error("[usePostComments] Falha ao comentar", error);
        return false;
      } finally {
        setSending(false);
      }
    },
    [postId, load]
  );

  return { tree, isLoading, sending, submit };
}
