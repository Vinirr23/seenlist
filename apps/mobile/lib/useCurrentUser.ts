import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchCurrentUser, type CurrentUser } from "./currentUser";
import { fetchSocialCounts, type SocialCounts } from "./socialCounts";

const CURRENT_USER_CACHE_VERSION = 1;

function currentUserCacheKeyFor(userId: string): string {
  return `seenlist:profile:current-user:v${CURRENT_USER_CACHE_VERSION}:${userId}`;
}

/**
 * CACHE LOCAL (a pedido — "Perfil abrir instantâneo") — `user` aqui
 * bloqueia a tela INTEIRA: `profile.tsx` só desenha o esqueleto
 * enquanto `user` é `null` (nem o layout, nem os carrosséis, nada
 * aparece antes disso) — é o dado mais crítico pra abertura
 * instantânea do Perfil. Mesmo padrão "stale-while-revalidate" já
 * usado em `useLibraryItems.ts`/`useDiscoverList.ts`: mostra o cache
 * salvo na hora (sem esqueleto), busca fresco por trás em silêncio,
 * substitui quando a resposta chega. `session.user.id` já está
 * disponível desde o primeiro render (a splash screen só esconde
 * depois da sessão resolvida — ver `AuthProvider.tsx`), então a
 * chave do cache nunca precisa esperar nada.
 */
export function useCurrentUser() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!session?.user || !userId) return;
    // Capturado aqui fora — dentro de `init()` (função aninhada,
    // assíncrona) o TypeScript não carrega a checagem acima, mesmo
    // sendo o mesmo valor (limitação conhecida do controle de fluxo
    // do TS através de closures assíncronas).
    const sessionUser = session.user;
    let cancelled = false;
    let hasShownCache = false;
    const cacheKey = currentUserCacheKeyFor(userId);

    async function init() {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (!cancelled && raw) {
          setUser(JSON.parse(raw) as CurrentUser);
          setIsLoading(false);
          hasShownCache = true;
        }
      } catch (error) {
        console.warn("[useCurrentUser] Cache local corrompido — ignorando", error);
      }

      if (cancelled) return;
      if (!hasShownCache) setIsLoading(true);

      try {
        const data = await fetchCurrentUser(sessionUser);
        if (cancelled) return;
        setUser(data);
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch((error) => {
          console.warn("[useCurrentUser] Falha ao salvar cache local", error);
        });
      } catch (error) {
        console.error("[useCurrentUser] Falha ao buscar usuário", error);
        if (!cancelled) setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [session?.user, userId]);

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
