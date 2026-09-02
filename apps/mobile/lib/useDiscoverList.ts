import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchDiscoverList,
  fetchGenreDiscoverList,
  fetchSimilarDiscoverList,
  type DiscoverItem,
  type DiscoverListKey,
  type GenreDiscoverKey,
  type SimilarDiscoverKey,
} from "./discover";
import { useTranslation } from "./i18n/LocaleProvider";

const CACHE_VERSION = 1;

function cacheKeyFor(list: DiscoverListKey, locale: string): string {
  return `seenlist:discover-list:v${CACHE_VERSION}:${list}:${locale}`;
}

/**
 * CACHE LOCAL (a pedido — "Explorar abrir instantâneo", mesmo padrão
 * já aplicado em Séries/Filmes via `useLibraryItems.ts`) — diferente
 * da biblioteca, essas listas NÃO são por usuário: é o mesmo
 * "tendências"/"populares" do TMDB pra todo mundo no mesmo idioma —
 * por isso a chave do cache é só lista+idioma, sem id de usuário.
 *
 * Mesmo padrão "stale-while-revalidate" dos outros caches: mostra o
 * que tiver salvo do AsyncStorage na hora (sem esqueleto), busca
 * fresco por trás em silêncio, substitui assim que a resposta chega.
 * Sem cache (1ª vez que a lista é aberta neste aparelho), cai no
 * comportamento de sempre — esqueleto até a 1ª busca terminar.
 */
export function useDiscoverList(list: DiscoverListKey) {
  const { locale } = useTranslation();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let hasShownCache = false;
    const cacheKey = cacheKeyFor(list, locale);

    async function init() {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (!cancelled && raw) {
          const cached = JSON.parse(raw) as DiscoverItem[];
          setItems(cached);
          setIsLoading(false);
          hasShownCache = true;
        }
      } catch (error) {
        console.warn(`[useDiscoverList] Cache local corrompido pra "${list}" — ignorando`, error);
      }

      if (cancelled) return;
      if (!hasShownCache) setIsLoading(true);
      setIsError(false);

      try {
        const data = await fetchDiscoverList(list, locale);
        if (cancelled) return;
        setItems(data);
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch((error) => {
          console.warn(`[useDiscoverList] Falha ao salvar cache local pra "${list}"`, error);
        });
      } catch (error) {
        console.error(`[useDiscoverList] Falha ao buscar lista "${list}"`, error);
        if (!cancelled) setIsError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [list, locale]);

  return { items, isLoading, isError };
}

/**
 * PORTE DO WEB (2026-09-02, reformulação completa da Explorar) —
 * `useDiscoverByGenre`/`useDiscoverSimilar` são a versão mobile de
 * `useDiscoverByGenre`/`useDiscoverSimilar` em
 * `apps/web/lib/queries/discover.ts` (react-query lá; aqui,
 * `useState`+`useEffect` manual, mesmo padrão do resto deste arquivo).
 * SEM cache no `AsyncStorage` de propósito, diferente de
 * `useDiscoverList` acima — essas duas dependem do gênero
 * favorito/título-âncora da PESSOA (não é o mesmo dado pra todo
 * mundo), então cachear por muito tempo arriscaria mostrar algo
 * desatualizado se a Biblioteca mudar; ficam só em memória, refazendo
 * a busca sempre que `genreId`/`anchorId` mudar.
 *
 * `genreId`/`anchorId` como `null` = "ainda não sei o valor" (gênero
 * favorito ainda carregando, ou pessoa sem item concluído daquele
 * tipo) — não dispara busca nenhuma até ter um valor de verdade,
 * mesmo racional do `enabled: genreId != null` do web.
 */
export function useDiscoverByGenre(kind: GenreDiscoverKey, genreId: number | null) {
  const { locale } = useTranslation();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (genreId == null) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchGenreDiscoverList(kind, genreId, locale)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((error) => {
        console.error(`[useDiscoverByGenre] Falha ao buscar "${kind}" (gênero ${genreId})`, error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, genreId, locale]);

  return { items, isLoading };
}

export function useDiscoverSimilar(kind: SimilarDiscoverKey, anchorId: number | null) {
  const { locale } = useTranslation();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (anchorId == null) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetchSimilarDiscoverList(kind, anchorId, locale)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((error) => {
        console.error(`[useDiscoverSimilar] Falha ao buscar "${kind}" (âncora ${anchorId})`, error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, anchorId, locale]);

  return { items, isLoading };
}
