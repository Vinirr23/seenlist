import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchCurrentUser, type CurrentUser } from "./currentUser";
import { fetchSocialCounts, type SocialCounts } from "./socialCounts";

export function useCurrentUser() {
  const { session } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    fetchCurrentUser(session.user)
      .then(setUser)
      .catch((error) => {
        console.error("[useCurrentUser] Falha ao buscar usuário", error);
        setIsError(true);
      })
      .finally(() => setIsLoading(false));
  }, [session?.user]);

  return { user, isLoading, isError };
}

/**
 * Correção (bug real, mesma causa já corrigida em "Minhas listas" e
 * nos carrosséis do Perfil) — buscava só na montagem; comentar em
 * outra tela e voltar pro Perfil nunca atualizava a contagem aqui.
 * `useFocusEffect` busca de novo toda vez que a tela ganha foco.
 */
export function useSocialCounts(userId: string | null) {
  const [counts, setCounts] = useState<SocialCounts | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchSocialCounts(userId).then(setCounts);
    }, [userId])
  );

  return counts;
}
