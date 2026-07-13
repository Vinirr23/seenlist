import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { LibraryItem } from "@seenlist/types";
import {
  fetchFollowCounts,
  fetchFollowStatus,
  fetchPublicFavorites,
  fetchPublicLibraryItems,
  fetchPublicProfile,
  toggleFollow,
  type UserProfile,
} from "./publicProfile";

export function usePublicProfile(username: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    fetchPublicProfile(username)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((error) => {
        console.error("[usePublicProfile] Falha ao buscar perfil", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  return { profile, isLoading, isError };
}

export function useFollowCounts(userId: string | null) {
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchFollowCounts(userId).then((data) => {
      if (!cancelled) setCounts(data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return counts;
}

export function useFollow(targetUserId: string) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFollowStatus(targetUserId).then((value) => {
      if (!cancelled) {
        setIsFollowing(value);
        setIsLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const toggle = useCallback(async () => {
    const previous = isFollowing;
    setBusy(true);
    setIsFollowing(!previous); // otimista
    try {
      await toggleFollow(targetUserId, previous);
    } catch (error) {
      console.error("[useFollow] Falha ao seguir/deixar de seguir", error);
      setIsFollowing(previous);
    } finally {
      setBusy(false);
    }
  }, [targetUserId, isFollowing]);

  return { isFollowing, isLoading, busy, toggle };
}

function usePublicItems(fetcher: (userId: string) => Promise<LibraryItem[]>, userId: string) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(() => {
    if (!hasLoadedOnce.current) setIsLoading(true);
    setIsError(false);
    return fetcher(userId)
      .then((data) => {
        setItems(data);
        hasLoadedOnce.current = true;
      })
      .catch((error) => {
        console.error("[usePublicItems] Falha ao buscar itens públicos", error);
        setIsError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /** TASK-125 (correção) — mesmo motivo de useLibraryItems.ts: recarrega sozinho ao voltar pra esta tela. */
  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce.current) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])
  );

  return { items, isLoading, isError };
}

export function usePublicFavorites(userId: string) {
  return usePublicItems(fetchPublicFavorites, userId);
}

export function usePublicLibraryItems(userId: string) {
  return usePublicItems(fetchPublicLibraryItems, userId);
}
