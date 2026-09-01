"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { recalculateUpToDateSeriesCategoriesThrottled } from "@/lib/queries/seriesCategoryRecalc";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { markElapsed } from "@/lib/perfMarks";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { ContinueWatchingCard } from "./ContinueWatchingCard";
import { UpToDatePendingGate } from "./UpToDatePendingGate";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { EmptyShelf } from "../media/EmptyShelf";
import { PopularMediaRow } from "../media/PopularMediaRow";
import { PageError } from "../media/PageError";
import { HomeSkeleton } from "../media/HomeSkeleton";

const CONTINUE_ASSISTINDO_LIMIT = 8;

/**
 * A PEDIDO — seção "Faz um tempo que você não assiste". Série que
 * está em "Assistindo" mas sem NENHUM episódio marcado há 2 semanas
 * desce automaticamente de "Continue assistindo" pra essa seção
 * separada, mais abaixo. Porta fiel do que já foi feito no mobile
 * (`app/(tabs)/series/index.tsx`), mesmo corte e mesma regra.
 *
 * Usa `lastActivityAt` (não `updatedAt`): esse campo já reflete o
 * episódio mais recente REALMENTE assistido, não só a última vez que
 * o status mudou — é o que faz "faz um tempo que você não assiste"
 * significar o que promete. Sem botão nenhum e sem tela própria (a
 * pedido) — a seção só aparece quando tem algo nela, e some sozinha
 * quando a pessoa volta a assistir.
 */
const STALE_AFTER_DAYS = 14;

/**
 * Ajuste — o botão de alternância grade/lista mora aqui agora
 * (canto superior direito, junto do "Continue assistindo"). Escopo
 * próprio (`useViewModePreference("series-library")`) — trocar aqui
 * nunca afeta Filmes nem o Perfil, que têm sua própria preferência
 * independente.
 *
 * Mesmos hooks de sempre (`useLibraryItems`, `useLibraryRealtimeSync`)
 * — nada mudou na lógica de status, no banco, ou no tracker. Só a
 * apresentação de "Continue assistindo" alterna entre grade
 * (`PosterGrid`) e lista (`MediaListRow`) — a prateleira de scroll
 * horizontal que existia antes era o modo "grade" implícito; agora é
 * uma escolha explícita, com uma alternativa de verdade ao lado.
 */
export function MinhaListaSection() {
  useLibraryRealtimeSync();
  const { data: items, isLoading, isError, error, refetch } = useLibraryItems();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("series-library");
  const { t } = useTranslation();

  /**
   * BUG REAL CORRIGIDO (2026-08-27, reportado — "barra de rolagem
   * duplicada em Home/Séries, preciso forçar várias vezes pra rolar"
   * — ver comentário completo em `ContinueWatchingCard.tsx`, no tipo
   * `ContinueWatchingCardProps`) — antes, cada `ContinueWatchingCard`
   * mantinha o `layout` do `motion` sempre ligado sozinho, os 8 ao
   * mesmo tempo, mesmo parado. Esse estado sobe pra cá: `layoutActive`
   * só fica `true` enquanto pelo menos 1 card está de fato no meio da
   * animação de marcar assistido — contador (não booleano simples)
   * porque, em teoria, mais de um card pode estar animando ao mesmo
   * tempo (nada impede tocar em dois cards diferentes em sequência
   * rápida) — cada card avisa quando começa/termina via
   * `onTransitionActiveChange`, incrementando/decrementando.
   */
  const [activeTransitionCount, setActiveTransitionCount] = useState(0);
  const handleTransitionActiveChange = useCallback((active: boolean) => {
    setActiveTransitionCount((count) => Math.max(0, count + (active ? 1 : -1)));
  }, []);
  const layoutActive = activeTransitionCount > 0;

  useEffect(() => {
    if (isError) {
      console.error("[MinhaListaSection] useLibraryItems() falhou", error);
    }
  }, [isError, error]);

  /**
   * TEMPORÁRIO (auditoria de performance) — equivalente exato do
   * `series_home_data_loaded` do mobile: dispara quando `isLoading`
   * (de `useLibraryItems()`, linha acima) vira `false`. Antes isso
   * estava (por engano) em `LibraryView.tsx`, rota `/library`, que não
   * é mais visitada por ninguém — essa aqui, `MinhaListaSection`, é
   * quem de fato carrega os dados na Home real (`/series`).
   *
   * MUDANÇA DE SIGNIFICADO (pedido — "abrir instantâneo mesmo com
   * biblioteca grande") — `useLibraryItems()` agora pinta uma PRÉVIA
   * (status/ordem certos, título/pôster placeholder) assim que as
   * linhas de status chegam, sem esperar o TMDB (ver `onStatusRowsReady`
   * em `library-state.ts`). `isLoading` vira `false` já nesse momento
   * — então esta marca passou a medir "quanto tempo até a lista
   * aparecer na tela" (o que importa pra sensação de instantâneo), não
   * mais "quanto tempo até pôster/título reais chegarem". Essa segunda
   * medida continua existindo, só que em outro lugar: `lib_tmdb_summaries_done`
   * (dentro de `fetchLibraryItems`) mede o fetch completo, com pôster
   * incluso, do início ao fim.
   *
   * CORREÇÃO (bug real, achado com dado de teste real em celular) —
   * `MinhaListaSection` remonta com bem mais frequência que a tela
   * inteira: além de sair-e-voltar pra Séries (que já remonta
   * `SeriesHome`), simplesmente trocar de "Em breve" de volta pra
   * "Minha Lista" TAMBÉM remonta este componente (renderização
   * condicional em `SeriesHome.tsx`), mesmo com `SeriesHome` continuando
   * montado o tempo todo. `mark()` puro (relativo ao início da
   * navegação) fazia cada uma dessas revisitas gravar um número cada
   * vez maior e sem sentido (quanto mais tarde na sessão a pessoa
   * voltasse pra "Minha Lista", maior o valor — sem relação nenhuma
   * com a velocidade real do carregamento daquela vez). `mountStartRef`
   * grava o instante em que ESTA montagem específica de
   * `MinhaListaSection` começou — próprio, independente do de
   * `SeriesHome` — e `markElapsed()` mede a partir daí, então o número
   * sempre reflete "quanto tempo esta visita específica levou pra
   * mostrar dado", seja a 1ª vez ou a enésima.
   */
  const mountStartRef = useRef<number | null>(null);
  if (typeof window !== "undefined" && mountStartRef.current === null) {
    mountStartRef.current = performance.now();
  }

  useEffect(() => {
    if (!isLoading && mountStartRef.current !== null) {
      markElapsed("series_home_data_loaded", mountStartRef.current);
    }
  }, [isLoading]);

  /**
   * CORREÇÃO (bug real, reportado) — mesmo espírito do
   * `useFocusEffect` do app nativo: ao abrir a Central de Séries,
   * recalcula sozinho quaisquer séries "Em dia" que já tenham
   * episódio novo pendente, promovendo de volta pra "Assistindo"
   * antes mesmo do usuário interagir. Silencioso — não mostra
   * spinner nem bloqueia a tela; só atualiza a lista se algo mudou.
   *
   * PERFORMANCE (achado real — "Home lenta") — usa a versão com
   * limite de 1x/dia (`...Throttled`, ver `seriesCategoryRecalc.ts`)
   * em vez da função crua: sem isso, essa checagem pesada (uma
   * chamada TMDB por temporada de CADA série "watching"/"up_to_date"
   * + rebuscar todo o histórico de episódios assistidos) rodava do
   * zero toda vez que essa tela montava — bastava sair da aba Séries
   * e voltar.
   *
   * CORREÇÃO (achado real de performance — auditoria de instrumentação
   * do TMDB): o `refetch()` disparava incondicionalmente, mesmo quando
   * `...Throttled()` pulava a recalculação (o caso comum — só roda de
   * verdade 1x/dia). Cada `refetch()` rebusca a Biblioteca INTEIRA,
   * TMDB incluído — um teste real de celular mostrou mais de 40
   * chamadas à rota de resumos do TMDB em ~5 segundos, só de trocar de
   * aba repetidamente. `...Throttled()` agora devolve `true` quando
   * realmente recalculou (categorias podem ter mudado, faz sentido
   * atualizar a lista) e `false` quando só pulou — só chama `refetch()`
   * no primeiro caso.
   */
  useEffect(() => {
    recalculateUpToDateSeriesCategoriesThrottled()
      .then((didRecalculate) => {
        if (didRecalculate) refetch();
      })
      .catch((err) => console.error("[MinhaListaSection] Falha ao recalcular categorias 'Em dia'", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  /**
   * A PEDIDO — "Faz um tempo que você não assiste": corte por
   * `lastActivityAt` (episódio realmente assistido), 14 dias. Feito
   * ANTES das listas de "Continue assistindo" porque as duas
   * precisam desse mesmo corte pra não mostrar a mesma série nas
   * duas seções.
   */
  const { recentSeries, staleSeries } = useMemo(() => {
    const cutoff = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const recent: typeof series = [];
    const stale: typeof series = [];

    for (const item of series) {
      // Só "watching" pode ficar parada — "Em dia" não tem nada
      // pendente pra assistir, então não faz sentido cobrar.
      const isStale = item.status === "watching" && new Date(item.lastActivityAt).getTime() < cutoff;
      (isStale ? stale : recent).push(item);
    }

    stale.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
    return { recentSeries: recent, staleSeries: stale };
  }, [series]);

  /**
   * Correção (bug real, reportado): "Em dia" (`up_to_date`) é um status
   * PRÓPRIO, separado de "watching" — mesma causa raiz já documentada
   * em `useUpcomingEpisodes`/"Em breve". Filtrando só "watching" aqui,
   * uma série que já estava em dia sumia de "Continue assistindo" pra
   * sempre, mesmo quando saía episódio novo — nunca tinha chance de
   * mostrar o card (e o selo NOVO) de novo, porque nada no web
   * recalcula essa categoria sozinho (diferente do app nativo, que
   * refaz esse recálculo toda vez que a aba ganha foco — decisão
   * documentada como só-nativo na época, não portada pro web).
   *
   * UNIFICAÇÃO (2026-08-25, bug real reportado — "Bleach aparece na
   * lista e não na grade") — antes esse filtro (`watching` OU
   * `up_to_date`) só valia pro modo LISTA; o modo GRADE usava um
   * segundo cálculo à parte, só `watching`, porque `PosterGrid` não
   * tinha como confirmar se uma série "em dia" tinha episódio
   * pendente de verdade (só `ContinueWatchingCard`, no modo lista,
   * sabia fazer essa checagem e se auto-esconder quando não tinha
   * nada pendente). Isso fazia a MESMA série (com episódio pendente
   * de verdade, mas status "em dia") aparecer só na lista, nunca na
   * grade — confuso, já que os dois modos deveriam mostrar o mesmo
   * conjunto de séries, só com apresentação diferente. Agora os dois
   * modos usam esta MESMA lista de candidatos (`continueWatching`,
   * abaixo).
   *
   * BUG REAL CORRIGIDO NA RAIZ (2026-09-01, reportado — "está tudo
   * em dia, e não apareceu nada", print confirmando espaço em branco
   * embaixo de "CONTINUE WATCHING") — `continueWatching` (candidatos
   * por STATUS bruto) é suficiente pra decidir o que RENDERIZAR
   * dentro de cada card, mas não era suficiente pra decidir SE tem
   * algo pra mostrar: uma série "em dia" só tem episódio de verdade
   * quando `findPendingEpisodes` confirma isso, e essa confirmação é
   * ASSÍNCRONA (busca a série na TMDB). Antes, essa confirmação só
   * acontecia tarde demais — escondida dentro de cada card
   * (`ContinueWatchingCard`) ou dentro da antiga
   * `ContinueWatchingPosterGrid`/`UpToDateGate` (removida, ver
   * `UpToDatePendingGate.tsx`) — depois que o container já tinha
   * decidido "tem algo, então mostra a lista/grade" só de olhar
   * `continueWatching.length > 0`. Quando NENHUMA série "em dia" da
   * pessoa tinha episódio pendente de verdade (cenário comum —
   * "tudo em dia"), cada card se escondia sozinho ao confirmar isso,
   * sobrando um espaço em branco no lugar da mensagem de vazio.
   *
   * `visibleContinueWatching` (abaixo) sobe essa MESMA confirmação
   * pro nível do container, ANTES da decisão — só depois de saber de
   * verdade quantas séries "em dia" têm episódio pendente é que a
   * tela escolhe entre lista/grade normal e a mensagem de vazio/
   * "tudo em dia" (+ "Populares no SeenList"). `UpToDatePendingGate`
   * reaproveita a mesma checagem (`findPendingEpisodes`) sem duplicar
   * a regra — só mudou ONDE o resultado dela é usado pra decidir.
   */
  const continueWatching = useMemo(
    () =>
      recentSeries
        .filter((item) => item.status === "watching" || item.status === "up_to_date")
        /*
         * CORREÇÃO (bug real, reportado — Tanya the Evil, Daemons do
         * Reino das Sombras e Rick and Morty sumindo só no modo
         * lista) — antes ordenava tudo junto por `updatedAt`, sem
         * diferenciar "watching" (tem episódio pronto pra assistir
         * AGORA) de "up_to_date" (pode não ter nada pendente, só
         * está aqui pra eventualmente voltar a mostrar o selo NOVO).
         * Ao ampliar o filtro pra incluir "up_to_date", o corte de
         * `CONTINUE_ASSISTINDO_LIMIT` passou a ter mais candidatos
         * disputando as mesmas vagas — uma série "up_to_date"
         * mexida recentemente conseguia empurrar pra fora do top-8
         * uma série "watching" de verdade, mesmo essa tendo algo
         * pendente pra assistir agora. Ordenação em duas camadas:
         * primeiro por status (watching sempre antes de up_to_date),
         * dentro de cada grupo por `updatedAt`. Uma série com
         * episódio pendente de verdade nunca perde vaga pra uma que
         * talvez nem tenha nada pra mostrar.
         */
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "watching" ? -1 : 1;
          return b.updatedAt.localeCompare(a.updatedAt);
        })
        .slice(0, CONTINUE_ASSISTINDO_LIMIT),
    [recentSeries]
  );

  /**
   * Ver comentário longo acima de `continueWatching` ("BUG REAL
   * CORRIGIDO NA RAIZ") — `confirmedPending` guarda, por id de série
   * "em dia", se ela de fato tem episódio pendente (`true`/`false`),
   * assim que cada `UpToDatePendingGate` (montado mais abaixo, um por
   * candidata) termina de checar. Ausente do objeto = ainda checando.
   */
  const [confirmedPending, setConfirmedPending] = useState<Record<number, boolean>>({});
  const handlePendingResolved = useCallback((seriesId: number, hasPending: boolean) => {
    setConfirmedPending((current) => (current[seriesId] === hasPending ? current : { ...current, [seriesId]: hasPending }));
  }, []);

  const upToDateCandidateIds = useMemo(
    () => continueWatching.filter((item) => item.status === "up_to_date").map((item) => item.id),
    [continueWatching]
  );

  // "watching" sempre conta (nunca precisa de confirmação — sempre tem
  // episódio pendente por definição do próprio status); "em dia" só
  // conta depois que `UpToDatePendingGate` confirmar `true`.
  const visibleContinueWatching = useMemo(
    () => continueWatching.filter((item) => item.status === "watching" || confirmedPending[item.id] === true),
    [continueWatching, confirmedPending]
  );

  // Ainda faltam candidatas "em dia" sem resposta — só importa
  // esperar quando a lista visível ainda está vazia (se já tem
  // "watching" confirmado pra mostrar, não faz sentido segurar a
  // tela só por causa de uma checagem que só afetaria o card em si).
  const stillResolvingPending =
    visibleContinueWatching.length === 0 && upToDateCandidateIds.some((id) => confirmedPending[id] === undefined);

  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>{t("seriesHome.continueWatching")}</SectionTitle>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/*
        * Gates invisíveis (ver "BUG REAL CORRIGIDO NA RAIZ" acima) —
        * um por série "em dia" candidata, sempre montados (não dependem
        * de `viewMode` nem de qual ramo abaixo está ativo) pra que a
        * confirmação comece assim que os dados chegam, e a decisão de
        * qual ramo mostrar já leve em conta o resultado.
        */}
      {upToDateCandidateIds.map((seriesId) => (
        <UpToDatePendingGate key={seriesId} seriesId={seriesId} onResolved={handlePendingResolved} />
      ))}

      {!viewModeReady ? (
        // CORREÇÃO (2026-08-27, "ainda mostra 2 esqueletons" — ver
        // comentário de `useViewModePreference.ts`) — enquanto o modo
        // grade/lista de verdade ainda não foi conferido no navegador
        // (`viewModeReady` false: servidor + instante inicial antes do
        // efeito rodar), não desenha NENHUM esqueleto — evita mostrar o
        // formato "grid" assumido e trocar de formato na frente da
        // pessoa assim que o valor real (ex.: "list") chegar.
        null
      ) : isLoading || stillResolvingPending ? (
        /*
         * `stillResolvingPending` (ver comentário em cima da própria
         * variável) — sem isso, a tela decidiria "vazio" cedo demais,
         * antes de confirmar se alguma série "em dia" tinha episódio
         * pendente, e trocaria de mensagem/conteúdo na frente da
         * pessoa assim que a confirmação chegasse (mesmo problema que
         * o `viewModeReady` acima evita, só que pra este outro dado
         * assíncrono).
         */
        <HomeSkeleton variant={viewMode === "grid" ? "grid" : "list"} />
      ) : visibleContinueWatching.length === 0 ? (
        /*
         * "Estado vazio melhorado" (2026-09-01, a pedido, opção
         * escolhida pelo usuário entre as recomendações do GPT) —
         * antes essa mensagem era ÚNICA ("Você ainda não está
         * acompanhando nenhuma série") mesmo pra quem já tinha
         * assistido tudo que adicionou (`series.length > 0`, só
         * `continueWatching` que zerou) — confuso pra quem já usa o
         * app há um tempo, parecia que a biblioteca tinha sumido.
         * Agora diferencia: `series.length === 0` é "nunca adicionou
         * nada" (mensagem original, com CTA pra Explorar); qualquer
         * série na Biblioteca mas nada pendente agora é "tudo em
         * dia" (`seriesHome.emptyCaughtUp`), reconhecendo que a
         * pessoa JÁ tem histórico. As duas variantes ganham a mesma
         * fileira "Populares no SeenList" embaixo (`PopularMediaRow`)
         * — sugestão de descoberta em vez de deixar a tela parada só
         * com o card vazio.
         */
        <>
          <EmptyShelf
            message={series.length === 0 ? t("seriesHome.emptyLibrary") : t("seriesHome.emptyCaughtUp")}
            actionLabel={t("seriesHome.exploreSeries")}
            actionHref="/explore"
          />
          <div className="mt-6">
            <PopularMediaRow list="trending_series" title={t("seriesHome.popularSeries")} />
          </div>
        </>
      ) : viewMode === "grid" ? (
        <PosterGrid items={visibleContinueWatching} />
      ) : (
        /*
         * CORREÇÃO (2026-08-25, "MARCAR EPISÓDIO: UMA EXPERIÊNCIA") —
         * era `space-y-3` (gap fixo via CSS, `margin-top` entre
         * irmãos). Trocado por um `<div>` simples porque agora quem
         * controla o espaçamento é o PRÓPRIO card (`mb-3 last:mb-0` no
         * `motion.div` raiz de `ContinueWatchingCard.tsx`) — precisa
         * ser assim pra poder animar esse espaçamento a 0 quando o
         * card sai (senão o `space-y-3` do pai brigaria com a
         * animação do filho, e sobraria um buraco vazio na saída).
         */
        <div>
          {visibleContinueWatching.map((item, index) => (
            /*
             * A PEDIDO (polimento visual, 2026-08-25 — ajustado depois
             * de comparar com o print de referência do usuário) —
             * barrinha de degradê na lateral esquerda, mais forte no
             * topo e clareando nos de baixo (`priorityIndex`, ver
             * `getPriorityAccentOpacity` em `ContinueWatchingCard.tsx`).
             * Só aqui, nunca no `.map` de "Faz um tempo que você não
             * assiste" logo abaixo.
             */
            <ContinueWatchingCard
              key={item.id}
              item={item}
              priorityIndex={index}
              layoutActive={layoutActive}
              onTransitionActiveChange={handleTransitionActiveChange}
            />
          ))}
        </div>
      )}

      {/*
        * A PEDIDO — "Ver todas da lista Assistir depois"
        * (`WatchlistButton`) removido daqui. A lista continua
        * acessível normalmente (a rota não foi apagada), só não
        * ocupa mais espaço fixo no fim da Home.
        */}

      {staleSeries.length > 0 && (
        <div className="mt-8">
          <SectionTitle>Faz um tempo que você não assiste</SectionTitle>
          <div className="mt-2">
            {viewMode === "grid" ? (
              <PosterGrid items={staleSeries} />
            ) : (
              // Mesmo motivo do `.map` de "Continue assistindo" acima — sem `space-y-3`, o espaçamento agora é do próprio card (`mb-3 last:mb-0`).
              <div>
                {/*
                  * A PEDIDO — mesma correção já feita no mobile: usa
                  * o MESMO card completo do "Continue assistindo"
                  * (`ContinueWatchingCard`: código do episódio, selo
                  * NOVO/MAIS RECENTE, botão de check rápido) em vez
                  * de um card simples só com progresso, que ficava
                  * visualmente inconsistente com o resto da tela. O
                  * componente já sabe voltar `null` sozinho quando a
                  * série não tem episódio pendente de verdade.
                  */}
                {staleSeries.map((item) => (
                  <ContinueWatchingCard
                    key={item.id}
                    item={item}
                    layoutActive={layoutActive}
                    onTransitionActiveChange={handleTransitionActiveChange}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
