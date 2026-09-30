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

/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-30, bug real reportado — "série que
 * estou acompanhando hora aparece hora não aparece logo de cara" ao
 * abrir o app) — investigação completa: `load()` já tinha um
 * `try/catch` que captura qualquer falha de rede e só loga
 * (`console.error`) + marca `isError`, sem tentar de novo. Numa rede
 * ainda "acordando" (app recém-aberto, rádio do celular reconectando),
 * essa falha é comum e passageira — mas sem retry automático, a tela
 * fica presa no que já tinha (cache antigo, ou nada) até o próximo
 * foco da tela (até 2h depois) ou até a pessoa puxar pra atualizar na
 * mão. Uma única tentativa automática, com um atraso pequeno, cobre
 * exatamente esse caso sem arriscar um loop de tentativas.
 */
const RETRY_DELAY_MS = 2500;

function cacheKeyFor(userId: string | undefined, locale: string): string | null {
  if (!userId) return null;
  return `seenlist:library-items:v${CACHE_VERSION}:${userId}:${locale}`;
}

/**
 * CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance — item
 * 1 da Etapa 1B: "useLibraryItems — evitar atualização de estado
 * desnecessária") — `setItems(data)` rodava incondicionalmente depois
 * de TODA busca (inicial, refoco, puxar-pra-atualizar), sempre com uma
 * referência de array NOVA, mesmo quando o conteúdo é idêntico ao que
 * já estava na tela — invalidando qualquer `memo`/`useMemo` downstream
 * que dependa de `items` por identidade.
 *
 * Fingerprint BARATO (não é deep-equal pesado): concatena só os campos
 * que a UI realmente mostra (status, progresso, título, pôster,
 * timestamps) por item, ordena as strings (a ORDEM de `items` não
 * importa pra decidir se o conteúdo mudou) e junta tudo numa string
 * só. Custa um `map`+`sort`+`join` sobre a lista — desprezível perto
 * do custo de um re-render de toda a árvore que depende de `items`
 * (o problema que estamos evitando). Cobre os 3 casos pedidos:
 * `status`/progresso mudando, item entrando/saindo (muda o CONJUNTO
 * de `mediaType:id` presentes na string) e metadata relevante mudando
 * (título/pôster/timestamps).
 */
function computeLibrarySignature(items: LibraryItem[]): string {
  return items
    .map((item) => {
      const progress = item.mediaType === "series" ? item.progress : undefined;
      return [
        item.mediaType,
        item.id,
        item.status,
        item.updatedAt,
        item.lastActivityAt,
        item.title,
        item.posterPath ?? "",
        progress?.watchedEpisodes ?? "",
        progress?.totalEpisodes ?? "",
        progress?.totalWatchEvents ?? "",
      ].join(":");
    })
    .sort()
    .join("|");
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
  const lastSignatureRef = useRef<string | null>(null);
  /** Ver `RETRY_DELAY_MS` acima — cancelado no unmount, pra nunca tentar de novo numa tela que já saiu de cena. */
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const cacheKey = cacheKeyFor(userId, locale);

  const load = useCallback(
    async (isRefresh: boolean, isRetryAttempt = false) => {
      if (isRefresh) setRefreshing(true);
      // Se já mostramos algo (cache ou busca anterior), nunca mais
      // volta pro esqueleto cheio — só pro spinner de refresh (acima)
      // quando for puxar-pra-atualizar de verdade.
      else if (!hasLoadedOnce.current && !hasShownCache.current) setIsLoading(true);
      if (!isRetryAttempt) setIsError(false);

      try {
        const data = await fetchLibraryItems(undefined, locale);
        // CORREÇÃO DE DESEMPENHO (2026-09-27, Etapa 1B, item 1) — ver
        // `computeLibrarySignature` acima: só troca a referência de
        // `items` (e, portanto, só re-renderiza quem depende dela) se
        // o conteúdo realmente mudou.
        const signature = computeLibrarySignature(data);
        if (signature !== lastSignatureRef.current) {
          lastSignatureRef.current = signature;
          setItems(data);
        }
        hasLoadedOnce.current = true;
        setIsError(false);
        if (cacheKey) {
          AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch((error) => {
            console.warn("[useLibraryItems] Falha ao salvar cache local — sem efeito na tela atual", error);
          });
        }
      } catch (error) {
        console.error("[useLibraryItems] Falha ao buscar a biblioteca", error);
        if (!isRetryAttempt) {
          // Ver `RETRY_DELAY_MS` acima — só UMA tentativa automática,
          // silenciosa (não reativa `refreshing`/esqueleto de novo).
          retryTimeoutRef.current = setTimeout(() => {
            if (!unmountedRef.current) load(isRefresh, true);
          }, RETRY_DELAY_MS);
          return;
        }
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
            // CORREÇÃO DE DESEMPENHO (2026-09-27, Etapa 1B, item 1) —
            // guarda a "assinatura" do cache também, pra quando a
            // busca de rede que vem em seguida (`load`, mais abaixo)
            // trouxer o MESMO conteúdo do cache local — sem isso, a
            // troca cache→rede sempre geraria uma referência nova de
            // `items` mesmo quando o dado é idêntico.
            lastSignatureRef.current = computeLibrarySignature(cached);
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

  /**
   * CORREÇÃO DE CAUSA RAIZ (2026-09-17, achado replicando o fix de
   * memoização do Perfil pras abas Séries/Filmes — "pode replicar nas
   * outras abas") — `refetch`/`refetchSilently` eram funções-seta
   * criadas AQUI, direto no objeto de retorno: uma identidade NOVA a
   * cada render deste hook, mesmo sem nada relevante ter mudado. Quem
   * chama (`series/index.tsx`) tentava construir um callback estável
   * com `useCallback([refetchSilently, ...])` pra passar pros cards
   * memoizados (`ContinueWatchingListRow`) — mas com a dependência
   * mudando de identidade a cada render, o `useCallback` nunca ficava
   * estável de verdade, e o `memo()` dos cards nunca segurava nada.
   * `load` já é estável (`useCallback`, depende só de `locale`/
   * `cacheKey`) — bastava embrulhar `refetch`/`refetchSilently` no
   * mesmo padrão pra herdar essa estabilidade.
   */
  const refetch = useCallback(() => load(true), [load]);
  const refetchSilently = useCallback(() => load(false), [load]);

  return { items, isLoading, isError, refreshing, refetch, refetchSilently };
}
