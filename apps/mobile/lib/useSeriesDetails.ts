import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { SeriesDetails, LibraryStatus } from "@seenlist/types";
import {
  episodeKey,
  fetchEpisodeRewatchCounts,
  fetchIsFavorite,
  fetchSeriesDetails,
  peekCachedSeriesDetails,
  fetchSeriesStatus,
  fetchWatchedEpisodes,
  fetchWatchedEpisodeIds,
  incrementEpisodeRewatch,
  markEpisodesWatched,
  removeSeriesFromLibrary,
  rewatchSeason as rewatchSeasonRequest,
  setSeriesStatus,
  toggleEpisodeWatched,
  toggleFavorite,
  unmarkSeasonWatched,
  type WatchedEpisodeKey,
} from "./seriesDetails";
import { hapticTick } from "./haptics";
import { useTranslation } from "./i18n/LocaleProvider";

export function useSeriesDetails(seriesId: string) {
  const { locale } = useTranslation();
  const [series, setSeries] = useState<SeriesDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    /*
     * CORREÇÃO (2026-09-27, Etapa 3 — mesmo achado/mesma causa raiz
     * de `useMovieDetails.ts`, ver o comentário lá) — conferir o
     * cache de forma síncrona antes de decidir `isLoading` evita o
     * esqueleto piscar ao reabrir uma série já em cache (ou já
     * pré-carregada pela Home via `prefetchSeriesDetails`).
     */
    const cached = peekCachedSeriesDetails(seriesId, locale);
    if (cached) {
      setSeries(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setIsError(false);

    fetchSeriesDetails(seriesId, locale)
      .then((data) => {
        if (!cancelled) setSeries(data);
      })
      .catch((error) => {
        console.error("[useSeriesDetails] Falha ao buscar detalhes", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [seriesId, reloadToken, locale]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { series, isLoading, isError, refetch };
}

export function useWatchedEpisodes(seriesId: number) {
  const [watched, setWatched] = useState<Set<WatchedEpisodeKey>>(new Set());
  /**
   * CORREÇÃO (2026-08-26 — "motor resistente a fusão de temporadas
   * pela TMDB") — companheiro de `watched`, EM SEPARADO de propósito,
   * mesmo raciocínio do web (`watched-episodes-state.ts`): `watched`
   * participa de atualização otimista logo abaixo (`toggle`/
   * `markMany`/`unmarkSeason` mexem nele direto, antes do servidor
   * responder) — misturar o Set de IDs nessa mesma estrutura
   * arriscaria essa lógica otimista já calibrada. Este Set é
   * recarregado (sem otimismo) depois que cada mutation confirma no
   * servidor — fica no máximo um instante desatualizado, e mesmo
   * nesse instante `isEpisodeWatchedSync` cai pro Set de chaves
   * (`watched`), que já está certo por causa do otimismo.
   */
  const [watchedEpisodeIds, setWatchedEpisodeIds] = useState<Set<number>>(new Set());
  /**
   * NOVO (2026-09-24, a pedido — "quando marco um episódio 'reassistido'
   * não muda nada visualmente, quero que mostre quantas vezes foi
   * reassistido") — companheiro de `watched`, mesmo padrão de
   * `watchedEpisodeIds`: recarregado (sem otimismo) depois de cada
   * mutation que pode ter mexido nele (`rewatch`/`rewatchSeason`), sem
   * entrar na lógica otimista de `toggle`/`markMany`/`unmarkSeason`
   * (essas nunca mudam contagem de rewatch).
   */
  const [rewatchCounts, setRewatchCounts] = useState<Map<WatchedEpisodeKey, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-17, a pedido — "desmarcar e marcar
   * está lento", confirmado pelo usuário no aparelho físico DEPOIS da
   * memoização do `SeasonAccordion` já aplicada hoje — ou seja, aquela
   * correção sozinha não bastou, a causa real estava mais fundo, aqui).
   *
   * `toggle` (abaixo) precisava ler `watched` pra saber `wasWatched` —
   * e por isso tinha `watched` na lista de dependências do
   * `useCallback`. Resultado: a CADA marcação/desmarcação (que muda
   * `watched`), o React cria uma função `toggle` NOVA. Essa função é
   * `onToggleEpisode` em `SeasonAccordion.tsx`, que por sua vez é
   * dependência do `handleEpisodePress` de lá (também um `useCallback`)
   * — então `handleEpisodePress` TAMBÉM virava uma função nova a cada
   * toque, e ela é exatamente o prop que o `SeasonEpisodeRow` memoizado
   * (a correção de hoje) usa pra decidir se re-renderiza. Uma prop de
   * função nova a cada render invalida o `React.memo` de TODAS as
   * linhas de novo — cancelando o ganho da memoização inteira, sem
   * nenhum aviso (nem erro, nem warning: só continuava lento).
   *
   * FIX: um `ref` espelha `watched` sempre que ele muda (efeito
   * simples, sem custo perceptível). `toggle` lê o valor mais recente
   * por esse ref em vez de pela variável capturada no closure — assim
   * a lista de dependências vira só `[seriesId]`, que não muda entre
   * marcações. `toggle` agora mantém a MESMA identidade de função
   * durante toda a vida da tela (só muda se a série mudar), e a
   * memoização de `SeasonEpisodeRow` volta a funcionar de verdade.
   */
  const watchedRef = useRef(watched);
  useEffect(() => {
    watchedRef.current = watched;
  }, [watched]);

  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-27, auditoria de performance —
   * item 4.1: "Série detalhes: mesmos dados buscados 2× na abertura")
   * — havia um `useEffect` de montagem AQUI (removido) fazendo
   * exatamente as mesmas 3 buscas que `reload` já faz logo abaixo via
   * `useFocusEffect(reload)`. Como `useFocusEffect` do expo-router
   * também dispara na montagem inicial (não só em refoco), os dois
   * rodavam juntos no primeiro `push` pra esta tela — dobrando as
   * requisições. `reload` agora também cuida de `isLoading` (antes só
   * o `useEffect` removido fazia isso), então continua: carregando na
   * primeira montagem E atualizando ao voltar pra tela — só que com 1
   * conjunto de requests, não 2. Nenhuma mudança na lógica dos dados.
   */
  const reload = useCallback(() => {
    fetchWatchedEpisodes(seriesId).then((data) => {
      setWatched(data);
      setIsLoading(false);
    });
    fetchWatchedEpisodeIds(seriesId).then((data) => setWatchedEpisodeIds(data));
    fetchEpisodeRewatchCounts(seriesId).then((data) => setRewatchCounts(data));
  }, [seriesId]);

  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-04 — "marcar/desmarcar episódio
   * dentro de detalhes de série não atualiza", bug real reportado no
   * mobile) — este hook guarda `watched`/`watchedEpisodeIds` em
   * `useState` LOCAL a cada chamada, sem cache compartilhado (o web
   * usa react-query com uma única entrada de cache por
   * `watchedEpisodesQueryKey(seriesId)`, vista por QUALQUER componente
   * que a consulte). A tela de Episódio (`episodes/[seriesId]/
   * [season]/[episode].tsx`) marca/desmarca direto (`toggleEpisodeWatched`,
   * sem passar por este hook) e nunca avisa esta instância aqui — ao
   * voltar pra Detalhes de Série, a pilha de navegação só REVELA a
   * tela de novo (não remonta), então um `useEffect` que só roda uma
   * vez, na montagem, nunca dispararia de novo, e o Set de assistidos
   * ficaria desatualizado até a pessoa sair e voltar pra tela pelo
   * caminho todo de novo.
   *
   * Mesmo padrão já usado em outros lugares do app pra exatamente esse
   * tipo de bug (`useLibraryItems.ts`, `useCurrentUser.ts`,
   * `usePublicProfile.ts`, `lists/[id].tsx`) — `useFocusEffect` busca
   * de novo toda vez que a tela ganha foco, inclusive ao voltar de uma
   * tela empilhada por cima. Como ele também roda na montagem inicial,
   * é a ÚNICA fonte de busca agora (ver correção acima).
   */
  useFocusEffect(reload);

  const toggle = useCallback(
    // CORREÇÃO (2026-08-26 — "motor resistente", ver seriesDetails.ts) — episodeId opcional, repassado direto pra gravação.
    async (seasonNumber: number, episodeNumber: number, episodeId?: number) => {
      /*
       * CAUSA RAIZ ENCONTRADA (2026-09-17, medida de verdade — ver
       * diagnóstico entregue ao usuário) — não era aqui: esta função
       * sempre foi rápida (~1-2ms até `setWatched`). O culpado de
       * verdade era `handleEpisodePress`, em `SeasonAccordion.tsx` —
       * ver o comentário grande lá (mesma classe de bug do `watchedRef`
       * logo acima, só que dentro do acordeão).
       */
      hapticTick();
      const key = episodeKey(seasonNumber, episodeNumber);
      const wasWatched = watchedRef.current.has(key);

      // Otimista: muda a tela antes da resposta do servidor, desfaz se der erro.
      setWatched((current) => {
        const next = new Set(current);
        if (wasWatched) next.delete(key);
        else next.add(key);
        return next;
      });

      try {
        await toggleEpisodeWatched(seriesId, seasonNumber, episodeNumber, wasWatched, episodeId);
        // CORREÇÃO (2026-08-26 — "motor resistente") — recarrega o Set de IDs já confirmado no servidor (sem otimismo aqui, ver comentário grande acima).
        fetchWatchedEpisodeIds(seriesId).then((data) => setWatchedEpisodeIds(data));
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao marcar/desmarcar episódio", error);
        setWatched((current) => {
          const next = new Set(current);
          if (wasWatched) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    },
    [seriesId]
  );

  /** TASK-113 — "marcar episódios anteriores?" e "marcar temporada inteira" usam a mesma função, só muda a lista de episódios passada. */
  const markMany = useCallback(
    async (episodes: { seasonNumber: number; episodeNumber: number; episodeId?: number }[]) => {
      setBusy(true);
      setWatched((current) => {
        const next = new Set(current);
        for (const e of episodes) next.add(episodeKey(e.seasonNumber, e.episodeNumber));
        return next;
      });
      try {
        await markEpisodesWatched(seriesId, episodes);
        // CORREÇÃO (2026-08-26 — "motor resistente") — ver comentário grande acima.
        fetchWatchedEpisodeIds(seriesId).then((data) => setWatchedEpisodeIds(data));
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao marcar vários episódios", error);
        reload(); // desfazer otimista de vários itens de uma vez é mais simples recarregando do que revertendo item a item
      } finally {
        setBusy(false);
      }
    },
    [seriesId, reload]
  );

  const unmarkSeason = useCallback(
    async (seasonNumber: number) => {
      setBusy(true);
      const prefix = `${seasonNumber}-`;
      setWatched((current) => new Set([...current].filter((key) => !key.startsWith(prefix))) as Set<WatchedEpisodeKey>);
      try {
        await unmarkSeasonWatched(seriesId, seasonNumber);
        // CORREÇÃO (2026-08-26 — "motor resistente") — ver comentário grande acima.
        fetchWatchedEpisodeIds(seriesId).then((data) => setWatchedEpisodeIds(data));
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao desmarcar temporada", error);
        reload();
      } finally {
        setBusy(false);
      }
    },
    [seriesId, reload]
  );

  const rewatch = useCallback(
    async (seasonNumber: number, episodeNumber: number) => {
      try {
        await incrementEpisodeRewatch(seriesId, seasonNumber, episodeNumber);
        // NOVO (2026-09-24) — recarrega a contagem já confirmada no servidor, pro badge "+N" aparecer sem precisar sair e voltar da tela.
        fetchEpisodeRewatchCounts(seriesId).then((data) => setRewatchCounts(data));
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao marcar reassistido", error);
      }
    },
    [seriesId]
  );

  /**
   * NOVO (2026-09-24, a pedido — sheet de temporada com "Reassistir")
   * — versão em lote de `rewatch`, acima: usada quando a temporada já
   * está 100% assistida e o usuário escolhe "Reassistir" em vez de
   * "Desmarcar" no sheet (`SeasonAccordion.tsx`). Não mexe em
   * `watched` (nenhum episódio muda de estado assistido/não assistido
   * — só a contagem de rewatch sobe).
   */
  const rewatchSeasonAction = useCallback(
    async (seasonNumber: number) => {
      setBusy(true);
      try {
        await rewatchSeasonRequest(seriesId, seasonNumber);
        fetchEpisodeRewatchCounts(seriesId).then((data) => setRewatchCounts(data));
      } catch (error) {
        console.error("[useWatchedEpisodes] Falha ao reassistir temporada", error);
      } finally {
        setBusy(false);
      }
    },
    [seriesId]
  );

  return { watched, watchedEpisodeIds, rewatchCounts, isLoading, busy, toggle, markMany, unmarkSeason, rewatch, rewatchSeasonAction, reload };
}

export function useSeriesStatus(seriesId: number) {
  const [status, setStatus] = useState<LibraryStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-27, auditoria de performance —
   * item 4.1, mesmo achado de `useWatchedEpisodes` acima) — havia um
   * `useEffect` de montagem AQUI (removido) buscando exatamente o
   * mesmo `fetchSeriesStatus` que `reload` já faz via
   * `useFocusEffect(reload)` logo abaixo — os dois disparavam juntos
   * no primeiro `push` pra esta tela. `reload` agora também cuida de
   * `isLoading`, preservando o comportamento: carrega na primeira
   * montagem e atualiza ao voltar pra tela, só que com 1 request, não 2.
   */
  const reload = useCallback(() => {
    fetchSeriesStatus(seriesId).then((data) => {
      setStatus(data);
      setIsLoading(false);
    });
  }, [seriesId]);

  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-04) — mesmo raciocínio de
   * `useWatchedEpisodes` acima: marcar/desmarcar um episódio na tela
   * de Episódio dispara `recalculateSeriesCategoryAfterEpisodeChange`
   * no servidor (pode promover/rebaixar a categoria da série —
   * "Assistindo" → "Em dia"/"Concluída" e vice-versa), mas essa tela
   * não sabe nada sobre este hook. Sem isso, o status mostrado aqui
   * (usado, por exemplo, por `EpisodeCarousel`) ficava desatualizado
   * ao voltar pra Detalhes de Série. Como `useFocusEffect` também
   * dispara na montagem inicial, é a ÚNICA fonte de busca agora (ver
   * correção acima).
   */
  useFocusEffect(reload);

  const changeStatus = useCallback(
    async (newStatus: LibraryStatus) => {
      hapticTick();
      const previous = status;
      const next = previous === newStatus ? null : newStatus;
      setBusy(true);
      setStatus(next); // otimista

      try {
        await setSeriesStatus(seriesId, newStatus, previous);
      } catch (error) {
        console.error("[useSeriesStatus] Falha ao mudar status", error);
        setStatus(previous);
      } finally {
        setBusy(false);
      }
    },
    [seriesId, status]
  );

  return { status, isLoading, busy, changeStatus };
}

export function useIsFavorite(seriesId: number) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchIsFavorite(seriesId).then((value) => {
      if (!cancelled) setIsFavorite(value);
    });
    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const toggle = useCallback(async () => {
    hapticTick();
    const previous = isFavorite;
    setBusy(true);
    setIsFavorite(!previous); // otimista
    try {
      await toggleFavorite(seriesId, previous);
    } catch (error) {
      console.error("[useIsFavorite] Falha ao favoritar/desfavoritar", error);
      setIsFavorite(previous);
    } finally {
      setBusy(false);
    }
  }, [seriesId, isFavorite]);

  return { isFavorite, busy, toggle };
}

export async function removeSeries(seriesId: number): Promise<void> {
  await removeSeriesFromLibrary(seriesId);
}
