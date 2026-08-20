import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { LibraryItem } from "@seenlist/types";
import { fetchLibraryItems } from "./library";
import { useTranslation } from "./i18n/LocaleProvider";
import { useAuth } from "./auth/AuthProvider";

export interface UseLibraryItemsResult {
  items: LibraryItem[] | null;
  isLoading: boolean;
  isError: boolean;
  refreshing: boolean;
  refetch: () => Promise<void>;
  /** TASK-151 (correção — spinner de "puxar pra atualizar" aparecendo sozinho) — igual a `refetch`, mas nunca ativa `refreshing`. Pra atualizações automáticas em segundo plano (ex.: depois do recálculo de categoria ao focar a aba) que não devem mostrar o círculo giratório do puxar-pra-atualizar. */
  refetchSilently: () => Promise<void>;
}

export interface UseLibraryItemsOptions {
  /**
   * ACHADO DE PERFORMANCE (a pedido — "Séries busca a biblioteca 2x
   * toda abertura") — antes, este hook SEMPRE disparava sua própria
   * busca ao montar, e a `SeriesHomeScreen` (única tela que precisa
   * recalcular categorias ANTES de mostrar dado atualizado) também
   * disparava a sua via `refetchSilently()` logo em seguida, no
   * mesmo `useFocusEffect` que já rodava na primeira montagem — duas
   * buscas completas da biblioteca, uma atrás da outra, medido em
   * teste real de aparelho (`adb logcat`, marca `series_home_render`
   * repetindo 3-4x depois de `series_home_data_loaded`, num total de
   * 1 a 3 segundos de trabalho e rede à toa).
   *
   * Com `skipInitialLoad: true`, este hook NÃO dispara a busca
   * automática ao montar — quem chama fica responsável por chamar
   * `refetchSilently()`/`refetch()` na hora certa. O cache local (ver
   * abaixo) continua funcionando igual: a tela ainda aparece
   * instantânea se já existir cache, só a busca de REDE inicial é
   * adiada pra depois de qualquer preparação própria da tela.
   */
  skipInitialLoad?: boolean;
  /**
   * Mesma ideia, pro refetch automático que este hook dispara sozinho
   * toda vez que a tela volta a ficar em foco — desliga quando quem
   * chama já tem seu próprio `useFocusEffect` decidindo quando
   * rebuscar (ex.: a Home de Séries, que precisa recalcular
   * categorias ANTES de rebuscar, não só rebuscar puro).
   */
  skipFocusRefetch?: boolean;
}

const CACHE_VERSION = 1;

function cacheKeyFor(userId: string | undefined, locale: string): string | null {
  if (!userId) return null;
  return `seenlist:library-items:v${CACHE_VERSION}:${userId}:${locale}`;
}

/**
 * TASK-125 (correção — atualização automática) — porta de
 * `useLibraryItems` (react-query no web, que refaz a busca sozinho
 * sempre que a tela volta a ficar em foco). A versão anterior só
 * buscava uma vez, no primeiro carregamento — por isso uma série
 * marcada como "Em dia" na tela de detalhes continuava aparecendo em
 * "Continue assistindo" até a pessoa atualizar manualmente. Agora,
 * toda vez que a tela volta a ficar em foco (`useFocusEffect`,
 * reexportado pelo próprio `expo-router` — nenhuma dependência
 * nova), busca de novo sozinho. A primeira busca (no mount) continua
 * mostrando o indicador de carregamento normal; buscas de foco
 * seguintes acontecem em silêncio, sem piscar a tela.
 *
 * CACHE LOCAL (a pedido — "carregar instantaneamente") — além de
 * buscar no Supabase, guarda a última lista buscada com sucesso no
 * `AsyncStorage` do aparelho, por usuário + idioma. Ao montar, ANTES
 * de qualquer busca de rede, tenta ler esse cache — se existir,
 * mostra ele na hora (sem esqueleto de carregamento nenhum) enquanto
 * a busca de rede roda por trás, em silêncio, e substitui o cache
 * pelo dado fresco assim que chega (padrão "stale-while-revalidate").
 * Sem cache (1º uso do app, ou depois de trocar de conta), continua
 * caindo no comportamento de sempre (esqueleto até a 1ª busca
 * terminar). Cache isolado por `userId` — cada conta só vê o próprio
 * cache, nunca o de outra conta usada antes no mesmo aparelho.
 */
export function useLibraryItems(options: UseLibraryItemsOptions = {}): UseLibraryItemsResult {
  const { skipInitialLoad = false, skipFocusRefetch = false } = options;
  const { locale } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);
  const hasShownCache = useRef(false);

  const cacheKey = cacheKeyFor(userId, locale);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) setRefreshing(true);
      // Se já mostramos algo (cache ou busca anterior), nunca mais
      // volta pro esqueleto cheio — só pro spinner de refresh (acima)
      // quando for puxar-pra-atualizar de verdade.
      else if (!hasLoadedOnce.current && !hasShownCache.current) setIsLoading(true);
      setIsError(false);

      try {
        const data = await fetchLibraryItems(undefined, locale);
        setItems(data);
        hasLoadedOnce.current = true;
        if (cacheKey) {
          AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch((error) => {
            console.warn("[useLibraryItems] Falha ao salvar cache local — sem efeito na tela atual", error);
          });
        }
      } catch (error) {
        console.error("[useLibraryItems] Falha ao buscar a biblioteca", error);
        setIsError(true);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setIsLoading(false);
      }
    },
    [locale, cacheKey]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (cacheKey && !hasLoadedOnce.current) {
        try {
          const raw = await AsyncStorage.getItem(cacheKey);
          if (!cancelled && raw && !hasLoadedOnce.current) {
            const cached = JSON.parse(raw) as LibraryItem[];
            setItems(cached);
            setIsLoading(false);
            hasShownCache.current = true;
          }
        } catch (error) {
          console.warn("[useLibraryItems] Cache local corrompido ou ilegível — ignorando", error);
        }
      }
      if (!cancelled && !skipInitialLoad && !hasLoadedOnce.current) {
        load(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, skipInitialLoad]);

  useFocusEffect(
    useCallback(() => {
      if (skipFocusRefetch) return;
      if (hasLoadedOnce.current) load(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skipFocusRefetch])
  );

  return { items, isLoading, isError, refreshing, refetch: () => load(true), refetchSilently: () => load(false) };
}
