"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Flame } from "lucide-react";
import { useLibraryRealtimeSync } from "@/lib/queries/library";
import { useContinueWatchingSeries } from "@/lib/queries/continueWatchingSeries";
import { recalculateUpToDateSeriesCategoriesThrottled } from "@/lib/queries/seriesCategoryRecalc";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { markElapsed } from "@/lib/perfMarks";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { ContinueWatchingCard } from "./ContinueWatchingCard";
import { UpToDatePendingGate } from "./UpToDatePendingGate";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { EmptyLibraryHero } from "../media/EmptyLibraryHero";
import { PopularMediaRow } from "../media/PopularMediaRow";
import { PageError } from "../media/PageError";
import { HomeSkeleton } from "../media/HomeSkeleton";

const CONTINUE_ASSISTINDO_LIMIT = 8;

/**
 * HISTÓRICO da ilustração do estado vazio de Séries/Home (mantido
 * aqui como referência, já que a lógica em si mudou de lugar — ver
 * `EmptyLibraryHero.tsx`, componente novo usado logo abaixo):
 * (1) emoji (🛋️🍿🪴), rejeitada — "você colocou ícone, quero uma
 * imagem criada por você"; (2) SVG desenhado à mão por mim, também
 * rejeitada — "parecem desenhado por uma criança"; (3) o próprio
 * usuário gerou e mandou a imagem real (`public/illustrations/
 * empty-library-couch.jpg`), processada (1402×1122 → 700×560, .jpg
 * otimizado); (4) removida a moldura (borda/sombra/cantos) que
 * sobrava em volta dela; (5) — ESTA — a ilustração + texto + botão
 * saíram de dentro de qualquer card (`EmptyShelf` era um card, por
 * definição) e passaram a `EmptyLibraryHero`, solto direto em cima
 * do fundo da Home (ver o comentário completo lá, incluindo a causa
 * raiz de por que só tirar a borda não bastava — os blobs azuis
 * desfocados que `SeriesHome.tsx` pinta atrás de tudo); (6) — a mais
 * recente — o usuário mandou um arquivo NOVO, desta vez com
 * transparência real de verdade (PNG RGBA, conferido pixel a pixel:
 * alfa 0 nos cantos, ~253 na cena) — `empty-library-couch.png`
 * substituiu o `.jpg` opaco, e a máscara CSS que fingia transparência
 * (item 5) foi removida por não ser mais necessária (ver
 * `EmptyLibraryHero.tsx` pro comentário completo).
 */

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
 *
 * MUDOU DE LUGAR (2026-09-01 — ver `continueWatchingSeries.ts`): o
 * corte de 14 dias em si (`STALE_AFTER_DAYS`) e o cálculo de
 * `recentSeries`/`staleSeries` viraram parte do hook compartilhado
 * `useContinueWatchingSeries`, junto com o resto da lógica de
 * "Continue assistindo" — precisava ser assim pra "Ver tudo"
 * (`ContinueWatchingAllView.tsx`) aplicar exatamente a MESMA exclusão
 * (senão uma série parada podia aparecer em Home E em "Ver tudo" ao
 * mesmo tempo).
 */

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
 *
 * REFATORADO (2026-09-01 — "sobre o limite de 8 cards na home, me
 * relembra a solução") — toda a lógica de "quais séries entram em
 * Continue assistindo" (filtro, ordenação, corte de 14 dias,
 * confirmação assíncrona de pendência) mudou pra `useContinueWatchingSeries`
 * (novo, `lib/queries/continueWatchingSeries.ts`), reaproveitado
 * também por `ContinueWatchingAllView.tsx` ("Ver tudo") — evita
 * exatamente o tipo de duplicação que já causou o bug real do Bleach
 * (`SEENLIST-HANDOFF.md`, "Bleach aparece na lista e não na grade").
 * Aqui só passa `limit: CONTINUE_ASSISTINDO_LIMIT`; "Ver tudo" chama
 * sem `limit`.
 */
export function MinhaListaSection() {
  useLibraryRealtimeSync();
  const { viewMode, setViewMode, isReady: viewModeReady } = useViewModePreference("series-library");
  const { t } = useTranslation();

  const {
    series,
    staleSeries,
    isLoading,
    isError,
    error,
    refetch,
    visibleContinueWatching,
    upToDateCandidateIds,
    handlePendingResolved,
    stillResolvingPending,
  } = useContinueWatchingSeries({ limit: CONTINUE_ASSISTINDO_LIMIT });

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

  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  /*
   * A PEDIDO (2026-09-01 — "no empty state, não faz sentido ter
   * 'continue assistindo/assistir depois' e a seleção de lista/grid.
   * tira isso, mas somente na tela de empty state") — só o cabeçalho
   * (título da seção + alternador grade/lista) some quando o estado
   * vazio de verdade está confirmado; nos outros ramos (carregando,
   * ainda resolvendo pendência, ou com cards) continua exatamente
   * como sempre foi, sem mudança nenhuma.
   */
  const isEmptyState = viewModeReady && !isLoading && !stillResolvingPending && visibleContinueWatching.length === 0;

  return (
    <>
      {!isEmptyState && (
        /*
         * PADRONIZADO (2026-09-01, a pedido — "deixe os espaços
         * padronizados") — era `mb-2` (8px, espaço entre o cabeçalho e
         * a lista/estado vazio abaixo); virou `mb-3` (12px), o mesmo
         * espaçamento título-conteúdo usado no Perfil
         * (`ProfileMediaCarousel.tsx`) e agora também em todo carrossel
         * de Explorar (`DiscoverCarousel.tsx`, ver comentário lá).
         */
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>{t("seriesHome.continueWatching")}</SectionTitle>
          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      )}

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
          {/*
            * REVERTIDO PRA ILUSTRAÇÃO ESTÁTICA (2026-09-01, a pedido —
            * "cancela a animação, coloca só essa imagem, aumenta uns
            * 15% o tamanho atual dela na home e pronto") — a versão
            * animada (`illustrationNode={<EmptyLibraryCouchScene />}`,
            * SVG inline de 2235 paths reagrupados) funcionava, mas o
            * material de origem (auto-trace de um PNG) trazia um efeito
            * colateral visual de "linhas de contorno" (posterização das
            * áreas de cor) que o usuário decidiu não valer o
            * trade-off — voltou a pedir a imagem raster simples.
            * `illustrationSrc` aponta pro MESMO arquivo já usado antes
            * da tentativa de animação (`empty-library-scene.png` —
            * conferido byte a byte, é o arquivo que o usuário reenviou
            * agora: PNG RGBA real, 51% do canvas 100% transparente,
            * seguindo o contorno dos objetos, sem vinheta). O aumento
            * de ~15% é só no tamanho do container, em `EmptyLibraryHero.tsx`
            * — ver comentário lá. O componente `EmptyLibraryCouchScene`
            * e o arquivo `emptyLibraryCouchSceneSvg.ts` (gerado por
            * script, ~520KB de markup) ficaram órfãos — removidos (ver
            * comandos `git rm` na entrega). As classes `.scene-*` de
            * `globals.css` também foram removidas (só serviam pros
            * grupos desse SVG).
            *
            * ANIMAÇÃO REMOVIDA DE VEZ + IMAGEM EM RESOLUÇÃO MAIOR
            * (2026-09-01, seguinte, a pedido) — `.empty-hero-float`
            * (que sobreviveu ao parágrafo acima) foi removida também;
            * ver comentário completo em `EmptyLibraryHero.tsx` e
            * `globals.css`. `empty-library-scene.png` virou a versão
            * 1536×1024 (era 768×512) — mesmo arquivo, resolução maior,
            * corrige o "borrado" em telas de alta densidade.
            */}
          <EmptyLibraryHero
            illustrationSrc="/illustrations/empty-library-scene.png"
            title={series.length === 0 ? t("seriesHome.emptyLibraryTitle") : t("seriesHome.emptyCaughtUpTitle")}
            subtitle={series.length === 0 ? t("seriesHome.emptyLibrarySubtitle") : t("seriesHome.emptyCaughtUpSubtitle")}
            actionLabel={t("seriesHome.exploreSeries")}
            actionHref="/explore?tab=series"
          />
          {/*
            * "mais espaço entre o botão e 'Populares no SeenList'" (a
            * pedido, 2026-09-01) — era `mt-6`, virou `mt-10` (respiro
            * logo abaixo do divisor "OU" de `EmptyLibraryHero`, que
            * teve o `pt-0` do próprio topo pra compensar — ver
            * comentário lá).
            *
            * PADRONIZADO (2026-09-01, seguinte, a pedido — "deixe os
            * espaços padronizados") — `mt-10` (40px) virou `mt-8`
            * (32px), o mesmo espaçamento entre blocos usado no Perfil
            * (`ProfileMediaCarousel.tsx`, `mb-8` entre carrosséis) e
            * já usado logo abaixo, na seção "Faz um tempo que você não
            * assiste" — três lugares, três valores diferentes (40px/
            * 32px/32px) viraram um só.
            *
            * "tira esse ---OU--- e sobe o 'Populares no SeenList'" (a
            * pedido, 2026-09-01, seguinte) — o `dividerLabel` do
            * `EmptyLibraryHero` acima foi removido (não passa mais
            * essa prop, então o divisor nem renderiza — ver
            * `EmptyLibraryHero.tsx`), e este `mt-8` (32px) virou
            * `mt-4` (16px): com o divisor fora, o respiro do `mt-8`
            * sozinho ficava grande demais entre o botão e esta
            * fileira.
            */}
          <div className="mt-4">
            <PopularMediaRow
              list="trending_series"
              title={
                /*
                 * BUG REAL CORRIGIDO (2026-09-01, reportado — "no
                 * print 2 o titulo... e o icone, são âmbar (o icone
                 * não é o icone padrão)") — antes era emoji 🔥 solto
                 * dentro de uma string, sem cor nenhuma (herdava o
                 * branco padrão de `DiscoverCarouselProps.title`).
                 * Trocado por um ícone de verdade (`Flame`, do mesmo
                 * `lucide-react` já usado em todo o app) + o texto,
                 * os dois na cor âmbar (`text-primary`) via um `span`
                 * pai — `currentColor` do ícone segue a cor do span
                 * automaticamente, sem precisar colorir os dois
                 * separado.
                 */
                <span className="flex items-center gap-1.5 text-primary">
                  <Flame className="h-4 w-4" fill="currentColor" strokeWidth={0} />
                  {t("seriesHome.popularSeries")}
                </span>
              }
              viewAllHref="/explore/all/trending_series"
            />
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
        * CORREÇÃO (2026-09-01, "você adicionou uma > ao lado de
        * 'continue assistindo' ao invés disso ao final dos 8 cards,
        * adicione um botão 'ver tudo'") — tentativa anterior era uma
        * setinha (`ChevronRight`) ao lado do título da seção, no
        * cabeçalho; rejeitada explicitamente. Agora é um botão de
        * verdade, com texto, posicionado DEPOIS dos cards renderizados
        * (grade OU lista, o `viewMode` não muda onde o botão entra) —
        * mesmo padrão visual "vidro" já usado no botão "Carregar mais"
        * de `DiscoverAllView.tsx`/`GenreAllView.tsx`/`SimilarAllView.tsx`
        * (mesma borda, blur, gradiente radial), reaproveitado aqui em
        * vez de inventar um estilo de botão novo. Mesma condição de
        * antes (`visibleContinueWatching.length > 0`) — sem botão
        * apontando pra uma tela "Ver tudo" vazia.
        */}
      {visibleContinueWatching.length > 0 && (
        <div className="mt-3 flex justify-center">
          <Link
            href="/series/continue-assistindo"
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-text backdrop-blur-[10px] backdrop-saturate-[160%] transition-colors"
            style={{
              background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
            }}
          >
            {t("seriesHome.viewAllContinueWatching")}
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </Link>
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
          {/* PADRONIZADO (2026-09-01, a pedido — "deixe os espaços padronizados") — era `mt-2` (8px), virou `mt-3` (12px), mesmo espaçamento título-conteúdo do resto da tela (ver comentário no cabeçalho de "Continue assistindo" acima). */}
          <div className="mt-3">
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
