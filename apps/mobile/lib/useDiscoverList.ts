import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchDiscoverList,
  fetchGenreDiscoverList,
  fetchSimilarDiscoverList,
  fetchDiscoverListPage,
  fetchGenreDiscoverListPage,
  fetchSimilarDiscoverListPage,
  type DiscoverItem,
  type DiscoverListKey,
  type GenreDiscoverKey,
  type SimilarDiscoverKey,
  type SimilarSource,
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

/**
 * PORTE DO WEB (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, implementa TUDO no mobile") — versão paginada de
 * `useDiscoverList` acima, só pra tela "ver todos"
 * (`app/explore/all/[list].tsx`), mesmo espírito de
 * `useDiscoverListInfinite` do web (`lib/queries/discover.ts`) — só
 * troca `useInfiniteQuery` (react-query) por estado manual
 * (`useState`+`useEffect`), mesmo padrão do resto deste arquivo.
 *
 * `requestIdRef` — sem react-query cuidando de corrida de requisição
 * sozinho, precisa de proteção manual: se `list`/`locale` mudar
 * enquanto uma página 2+ ainda está a caminho (`fetchNextPage`), a
 * resposta atrasada não pode ser aplicada por cima da lista NOVA já
 * carregada. Cada novo pedido (troca de lista, ou próxima página)
 * carimba um id crescente; a resposta só é aplicada se o id ainda for
 * o mais recente quando ela chegar.
 */
export function useDiscoverListInfinite(list: DiscoverListKey) {
  const { locale } = useTranslation();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setItems([]);
    setPage(1);
    setTotalPages(1);
    fetchDiscoverListPage(list, 1, locale)
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setItems(data.items);
        setPage(data.page);
        setTotalPages(data.totalPages);
      })
      .catch((error) => {
        console.error(`[useDiscoverListInfinite] Falha ao buscar "${list}" (página 1)`, error);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });
  }, [list, locale]);

  function fetchNextPage() {
    if (isFetchingNextPage || page >= totalPages) return;
    const requestId = requestIdRef.current;
    setIsFetchingNextPage(true);
    fetchDiscoverListPage(list, page + 1, locale)
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => [...prev, ...data.items]);
        setPage(data.page);
        setTotalPages(data.totalPages);
      })
      .catch((error) => {
        console.error(`[useDiscoverListInfinite] Falha ao buscar "${list}" (página ${page + 1})`, error);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsFetchingNextPage(false);
      });
  }

  return { items, isLoading, isFetchingNextPage, hasNextPage: page < totalPages, fetchNextPage };
}

/** Versão paginada de `useDiscoverByGenre`, só pra tela "ver todos" de um gênero (`app/explore/genre/[mediaType]/[genreId].tsx`) — mesmo raciocínio de `useDiscoverListInfinite` acima. Também expõe `genreMap` (a própria resposta já traz o mapa de nomes, ver `route.ts`) — a tela usa pra montar o título da página. */
export function useDiscoverByGenreInfinite(kind: GenreDiscoverKey, genreId: number | null) {
  const { locale } = useTranslation();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [genreMap, setGenreMap] = useState<Record<number, string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (genreId == null) {
      requestIdRef.current += 1;
      setItems([]);
      setGenreMap(null);
      setIsLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setItems([]);
    setPage(1);
    setTotalPages(1);
    fetchGenreDiscoverListPage(kind, genreId, 1, locale)
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setItems(data.items);
        setGenreMap(data.genreMap);
        setPage(data.page);
        setTotalPages(data.totalPages);
      })
      .catch((error) => {
        console.error(`[useDiscoverByGenreInfinite] Falha ao buscar "${kind}" (gênero ${genreId}, página 1)`, error);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });
  }, [kind, genreId, locale]);

  function fetchNextPage() {
    if (genreId == null || isFetchingNextPage || page >= totalPages) return;
    const requestId = requestIdRef.current;
    setIsFetchingNextPage(true);
    fetchGenreDiscoverListPage(kind, genreId, page + 1, locale)
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => [...prev, ...data.items]);
        setPage(data.page);
        setTotalPages(data.totalPages);
      })
      .catch((error) => {
        console.error(`[useDiscoverByGenreInfinite] Falha ao buscar "${kind}" (gênero ${genreId}, página ${page + 1})`, error);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsFetchingNextPage(false);
      });
  }

  return { items, genreMap, isLoading, isFetchingNextPage, hasNextPage: page < totalPages, fetchNextPage };
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

/**
 * Versão paginada de `useDiscoverSimilar`, só pra tela "ver todos"
 * (`app/explore/similar/[mediaType]/[anchorId].tsx`) — mesmo
 * raciocínio de `useDiscoverListInfinite`.
 *
 * IMPORTANTE, igual ao web (`useDiscoverSimilarInfinite`,
 * `lib/queries/discover.ts`) — `source` ("recommendations" vs.
 * "similar") só é decidido pelo SERVIDOR na página 1; guardado aqui
 * (`sourceRef`) e reenviado em toda página seguinte, pra origem dos
 * dados nunca trocar no meio da rolagem.
 */
export function useDiscoverSimilarInfinite(kind: SimilarDiscoverKey, anchorId: number | null) {
  const { locale } = useTranslation();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const requestIdRef = useRef(0);
  const sourceRef = useRef<SimilarSource | undefined>(undefined);

  useEffect(() => {
    if (anchorId == null) {
      requestIdRef.current += 1;
      setItems([]);
      setIsLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    sourceRef.current = undefined;
    setIsLoading(true);
    setItems([]);
    setPage(1);
    setTotalPages(1);
    fetchSimilarDiscoverListPage(kind, anchorId, 1, undefined, locale)
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        sourceRef.current = data.source;
        setItems(data.items);
        setPage(data.page);
        setTotalPages(data.totalPages);
      })
      .catch((error) => {
        console.error(`[useDiscoverSimilarInfinite] Falha ao buscar "${kind}" (âncora ${anchorId}, página 1)`, error);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsLoading(false);
      });
  }, [kind, anchorId, locale]);

  function fetchNextPage() {
    if (anchorId == null || isFetchingNextPage || page >= totalPages) return;
    const requestId = requestIdRef.current;
    setIsFetchingNextPage(true);
    fetchSimilarDiscoverListPage(kind, anchorId, page + 1, sourceRef.current, locale)
      .then((data) => {
        if (requestIdRef.current !== requestId) return;
        setItems((prev) => [...prev, ...data.items]);
        setPage(data.page);
        setTotalPages(data.totalPages);
      })
      .catch((error) => {
        console.error(`[useDiscoverSimilarInfinite] Falha ao buscar "${kind}" (âncora ${anchorId}, página ${page + 1})`, error);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setIsFetchingNextPage(false);
      });
  }

  return { items, isLoading, isFetchingNextPage, hasNextPage: page < totalPages, fetchNextPage };
}
