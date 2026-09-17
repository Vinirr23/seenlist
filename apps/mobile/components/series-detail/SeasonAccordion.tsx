import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Episode, SeasonWithEpisodes } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { isEpisodeWatchedSync, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import { hapticTick } from "@/lib/haptics";
import { Text, Glass } from "@/components/ui";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";
import { OptionSheet, type OptionSheetAction } from "@/components/settings/OptionSheet";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

type Dialog = { type: "mark-previous"; episodeNumber: number } | { type: "watched-actions"; episodeNumber: number } | { type: "season-toggle" } | null;

/**
 * TASK-113/115 — porta completa de `SeasonAccordion.tsx` do web:
 * marcar temporada inteira, "marcar episódios anteriores?",
 * "Reassistido", e (TASK-115) tocar no texto/imagem do episódio abre
 * a tela de Detalhes do Episódio — só o botão redondo continua
 * marcando/desmarcando direto, sem navegar.
 */
export function SeasonAccordion({
  seriesId,
  season,
  allSeasons,
  watched,
  watchedEpisodeIds,
  busy,
  onToggleEpisode,
  onMarkMany,
  onUnmarkSeason,
  onRewatch,
  defaultOpen = false,
  categoryColor,
}: {
  seriesId: number;
  season: SeasonWithEpisodes;
  /**
   * A PEDIDO (2026-09-17 — "quando marco a temporada 3, deveria
   * perguntar se quero marcar as temporadas anteriores também") —
   * lista de TODAS as temporadas da série (`series.seasons`, repassada
   * de `app/series/[id].tsx`), usada só pra descobrir se alguma
   * temporada ANTERIOR a esta ainda tem episódio pendente — ver
   * `earlierPendingEpisodes`, abaixo. Cada `SeasonAccordion` continua
   * exibindo só a SUA `season`; esta lista é usada apenas pra esse
   * cálculo, nunca renderizada.
   */
  allSeasons: SeasonWithEpisodes[];
  watched: Set<WatchedEpisodeKey>;
  /** CORREÇÃO (2026-08-26 — "motor resistente") — opcional, ver `isEpisodeWatchedSync` (seriesDetails.ts). */
  watchedEpisodeIds?: Set<number>;
  busy: boolean;
  /** `episodeId` opcional (2026-08-26, "motor resistente" — ver seriesDetails.ts) — ID fixo da TMDB, gravado junto quando disponível. */
  onToggleEpisode: (seasonNumber: number, episodeNumber: number, episodeId?: number) => void;
  onMarkMany: (episodes: { seasonNumber: number; episodeNumber: number; episodeId?: number }[]) => void;
  onUnmarkSeason: (seasonNumber: number) => void;
  onRewatch: (seasonNumber: number, episodeNumber: number) => void;
  defaultOpen?: boolean;
  /**
   * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-15 — "no web, ao colocar
   * uma série em 'assistir depois' fica da cor certa do status, no
   * mobile não está") — antes a categoria "não chegava neste
   * componente" (ver comentário antigo do `progressPercent`, removido).
   * Porte fiel do `colorClass` do `SeasonAccordion.tsx`/
   * `SeasonProgress.tsx` do web: porcentagem, barra de progresso da
   * temporada, selo de "temporada inteira assistida" e os botões de
   * cada episódio usam a cor da categoria ATUAL da série, vinda de
   * `getSeriesCategoryColorByStatus` (`lib/seriesCategories.ts`),
   * calculada uma vez em `app/series/[id].tsx` e repassada pra cá.
   * Opcional, cai em `colors.primary` (âmbar) quando não informado.
   */
  categoryColor?: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [dialog, setDialog] = useState<Dialog>(null);

  const watchedCount = season.episodes.filter((ep) =>
    isEpisodeWatchedSync(watched, ep.seasonNumber, ep.episodeNumber, ep.id, watchedEpisodeIds)
  ).length;
  const allWatched = season.episodes.length > 0 && watchedCount === season.episodes.length;
  const percentage = season.episodes.length > 0 ? Math.round((watchedCount / season.episodes.length) * 100) : 0;

  const sortedEpisodes = useMemo(() => [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber), [season.episodes]);

  /**
   * A PEDIDO (2026-09-17 — "quando marco a temporada 3, deveria
   * perguntar se quero marcar as 2 anteriores junto também") — todo
   * episódio de temporada ANTERIOR (número menor, ignorando a
   * temporada 0/especiais — mesmo critério já usado nos outros
   * cálculos deste app) que ainda não está assistido. Usado só pelo
   * botão de marcar/desmarcar a TEMPORADA INTEIRA (o círculo do
   * cabeçalho) — ver `buildDialogProps`/`confirmSeasonToggle`, abaixo.
   * Recalculado a cada render (barato: é só um filtro sobre os
   * episódios já carregados) — não precisa de `useMemo` porque não é
   * passado pra nenhum componente memoizado.
   */
  const earlierPendingEpisodes = allSeasons
    .filter((s) => s.seasonNumber > 0 && s.seasonNumber < season.seasonNumber)
    .flatMap((s) =>
      s.episodes
        .filter((ep) => !isEpisodeWatchedSync(watched, ep.seasonNumber, ep.episodeNumber, ep.id, watchedEpisodeIds))
        .map((ep) => ({ seasonNumber: s.seasonNumber, episodeNumber: ep.episodeNumber, episodeId: ep.id }))
    );

  /*
   * CORREÇÃO DE CAUSA RAIZ (2026-09-17, medida de verdade com
   * `performance.now()` — ver diagnóstico entregue ao usuário) — os
   * logs mostraram TODAS as linhas de uma temporada aberta
   * re-renderizando a cada marcação/desmarcação em QUALQUER OUTRA
   * temporada da mesma série, não só na tocada. Mesma classe de bug já
   * corrigida em `toggle` (`useSeriesDetails.ts`, ver `watchedRef` lá):
   * `handleEpisodePress`, abaixo, tinha `watched`/`watchedEpisodeIds`
   * (os `Set`s INTEIROS da série toda) nas dependências do
   * `useCallback` — e os dois mudam de identidade a cada marcação em
   * QUALQUER temporada, não só nesta. Resultado: mesmo marcando um
   * episódio da Temporada 3, `handleEpisodePress` da Temporada 1 virava
   * uma função nova — e como ela é o `onToggleWatched` que todo
   * `SeasonEpisodeRow` memoizado usa pra decidir se re-renderiza, isso
   * invalidava o `memo` de TODAS as linhas de TODAS as temporadas
   * abertas na tela, mesmo sem nenhuma mudança real nelas.
   *
   * FIX: mesmo padrão do `watchedRef` — dois `ref`s espelham `watched`/
   * `watchedEpisodeIds` sempre que mudam (efeito simples, sem custo
   * perceptível), e `handleEpisodePress` lê o valor mais recente pelos
   * refs em vez de pelas variáveis capturadas no closure. A lista de
   * dependências vira `[sortedEpisodes, season.seasonNumber,
   * onToggleEpisode]` — nenhuma delas muda quando OUTRA temporada é
   * marcada — então `handleEpisodePress` mantém a mesma identidade
   * entre marcações alheias, e o `memo` das linhas volta a bloquear
   * de verdade os re-renders que não são delas.
   */
  const watchedRef = useRef(watched);
  const watchedEpisodeIdsRef = useRef(watchedEpisodeIds);
  useEffect(() => {
    watchedRef.current = watched;
    watchedEpisodeIdsRef.current = watchedEpisodeIds;
  }, [watched, watchedEpisodeIds]);

  const handleEpisodePress = useCallback(
    (episodeNumber: number, isWatched: boolean) => {
      if (isWatched) {
        hapticTick();
        setDialog({ type: "watched-actions", episodeNumber });
        return;
      }

      const hasUnwatchedBefore = sortedEpisodes.some(
        (ep) =>
          ep.episodeNumber < episodeNumber &&
          !isEpisodeWatchedSync(watchedRef.current, season.seasonNumber, ep.episodeNumber, ep.id, watchedEpisodeIdsRef.current)
      );
      if (hasUnwatchedBefore) {
        hapticTick();
        setDialog({ type: "mark-previous", episodeNumber });
      } else {
        // Sem haptic aqui de propósito — `onToggleEpisode` é o `toggle`
        // do hook `useWatchedEpisodes`, que já vibra sozinho. Vibrar
        // aqui também duplicaria o toque num único gesto.
        // CORREÇÃO (2026-08-26 — "motor resistente") — ID fixo da TMDB, já disponível em `sortedEpisodes`.
        const episodeId = sortedEpisodes.find((ep) => ep.episodeNumber === episodeNumber)?.id;
        onToggleEpisode(season.seasonNumber, episodeNumber, episodeId);
      }
    },
    [sortedEpisodes, season.seasonNumber, onToggleEpisode]
  );

  /** Ver comentário grande em `handleEpisodePress`, acima — mesmo motivo. */
  const handleOpenEpisode = useCallback(
    (episodeNumber: number) => {
      router.push(`/episodes/${seriesId}/${season.seasonNumber}/${episodeNumber}`);
    },
    [router, seriesId, season.seasonNumber]
  );

  function markUpToEpisode(episodeNumber: number) {
    hapticTick();
    const episodes = sortedEpisodes
      .filter((ep) => ep.episodeNumber <= episodeNumber)
      .map((ep) => ({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, episodeId: ep.id }));
    onMarkMany(episodes);
    setDialog(null);
  }

  function markOnlyThisEpisode(episodeNumber: number) {
    const episodeId = sortedEpisodes.find((ep) => ep.episodeNumber === episodeNumber)?.id;
    onToggleEpisode(season.seasonNumber, episodeNumber, episodeId);
    setDialog(null);
  }

  /**
   * A PEDIDO (2026-09-17) — `includeEarlierSeasons` só importa quando
   * `allWatched` é falso (marcando, não desmarcando): `true` marca esta
   * temporada MAIS os episódios pendentes das anteriores
   * (`earlierPendingEpisodes`); `false` mantém o comportamento de
   * sempre (só esta temporada). Desmarcar continua igual — o usuário só
   * pediu esse comportamento pra MARCAR.
   *
   * TENTATIVA REVERTIDA (2026-09-17 — "ainda tem um delay" mesmo depois
   * de separar o fechamento do diálogo da marcação em dois quadros via
   * `requestAnimationFrame`) — medido de verdade: o tempo total não
   * melhorou (ficou igual ou pior, pela espera extra do próprio
   * `requestAnimationFrame`). Ou seja, o `Modal` do `OptionSheet` NÃO
   * era o gargalo — hipótese descartada. Revertido pro comportamento
   * direto; o diagnóstico continua (rodada 2 dos logs, em `markMany`/
   * `unmarkSeason`/`SeasonEpisodeRow`/`EpisodeCarousel`), procurando o
   * custo de verdade da atualização de vários episódios de uma vez.
   */
  function confirmSeasonToggle(includeEarlierSeasons: boolean) {
    hapticTick();
    if (allWatched) {
      onUnmarkSeason(season.seasonNumber);
    } else {
      const episodesDestaTemporada = season.episodes.map((ep) => ({
        seasonNumber: season.seasonNumber,
        episodeNumber: ep.episodeNumber,
        episodeId: ep.id,
      }));
      onMarkMany(includeEarlierSeasons ? [...earlierPendingEpisodes, ...episodesDestaTemporada] : episodesDestaTemporada);
    }
    setDialog(null);
  }

  const dialogProps = buildDialogProps(
    dialog,
    {
      onMarkUpTo: markUpToEpisode,
      onMarkOnlyThis: markOnlyThisEpisode,
      onUnwatch: (episodeNumber) => {
        onToggleEpisode(season.seasonNumber, episodeNumber);
        setDialog(null);
      },
      onRewatch: (episodeNumber) => {
        onRewatch(season.seasonNumber, episodeNumber);
        setDialog(null);
      },
      onConfirmSeasonToggle: confirmSeasonToggle,
      allWatched,
      earlierPendingSeasonsCount: new Set(earlierPendingEpisodes.map((ep) => ep.seasonNumber)).size,
    },
    t
  );

  return (
    <Glass style={styles.wrapper} variant="light">
      {/*
        PORTE DO WEB (2026-09-09, comparado no print) — o cabeçalho tinha
        só "12/12 assistidos" em 11px. No web (`SeasonAccordion.tsx` +
        `SeasonProgress.tsx`) ele tem TRÊS coisas: a contagem à
        esquerda, a PORCENTAGEM à direita na cor da categoria, e uma
        BARRA DE PROGRESSO embaixo das duas — nada disso existia aqui.
        A ordem dos dois controles da direita também estava trocada: no
        web o chevron vem PRIMEIRO (ele faz parte do botão que abre o
        acordeão) e o círculo de "marcar temporada" vem depois, solto.
      */}
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => setOpen((v) => !v)}>
          <View style={styles.headerText}>
            <Text style={styles.seasonName}>{season.name}</Text>
            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <Text variant="muted" style={styles.progressLabel}>
                  {t("seriesHome.episodeProgress", { watched: watchedCount, total: season.episodes.length })}
                </Text>
                <Text style={[styles.progressPercent, { color: categoryColor ?? colors.primary }]}>{percentage}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: categoryColor ?? colors.primary }]} />
              </View>
            </View>
          </View>
          {/* `transition-transform` + `rotate-180` do web — o web gira o MESMO ícone, não troca de ícone. */}
          <Feather
            name="chevron-down"
            size={16}
            color={colors.muted}
            style={open ? styles.chevronAberto : undefined}
          />
        </Pressable>

        {season.episodes.length > 0 && (
          <Pressable
            hitSlop={8}
            disabled={busy}
            onPress={() => setDialog({ type: "season-toggle" })}
          >
            {/*
              CORREÇÃO (2026-09-09, ampliado no print) — o `check-circle`
              do Feather é um círculo ABERTO, com o traço interrompido no
              canto e o check saindo por cima dele. O web usa o
              `CheckCircle2` do lucide: círculo FECHADO com o check
              inteiro DENTRO. São dois desenhos diferentes. O
              `check-circle-outline` do MaterialCommunityIcons é o
              equivalente do lucide; o vazio vem da mesma família pra os
              dois estados terem o mesmo traço.
            */}
            <MaterialCommunityIcons
              name={allWatched ? "check-circle-outline" : "circle-outline"}
              size={24}
              color={allWatched ? (categoryColor ?? colors.primary) : colors.muted}
            />
          </Pressable>
        )}
      </View>

      {open && (
        <View style={styles.episodeList}>
          {sortedEpisodes.map((episode) => (
            <SeasonEpisodeRow
              key={episode.id}
              episode={episode}
              isWatched={isEpisodeWatchedSync(watched, episode.seasonNumber, episode.episodeNumber, episode.id, watchedEpisodeIds)}
              categoryColor={categoryColor}
              onOpenEpisode={handleOpenEpisode}
              onToggleWatched={handleEpisodePress}
            />
          ))}
        </View>
      )}

      {dialogProps && <OptionSheet {...dialogProps} onDismiss={() => setDialog(null)} />}
    </Glass>
  );
}

/**
 * CORREÇÃO DE DESEMPENHO (2026-09-17, a pedido — "lentidão no Android
 * depois do Glass"; diagnóstico de código, não medição — números reais
 * de antes/depois dependem do teste no aparelho físico, pedido ao
 * usuário separadamente).
 *
 * CAUSA (hipótese, não confirmada por profiling): cada linha de
 * episódio é um `<Glass>` — um `BlurView` nativo de verdade no
 * Android, renderizado em tempo real (`blurMethod=
 * "dimezisBlurViewSdk31Plus"`, ver `components/ui/Glass.tsx`), não um
 * efeito estático pré-calculado. Antes desta correção, TODAS as linhas
 * de uma temporada aberta eram desenhadas inline dentro do `.map()` de
 * `SeasonAccordion`: qualquer mudança de estado do acordeão (abrir/
 * fechar, marcar QUALQUER episódio, trocar de diálogo) recriava a
 * árvore JSX inteira, e o React — sem nada pra comparar contra — re-
 * renderizava as 20+ linhas de novo, cada uma recalculando seu próprio
 * `BlurView` nativo. Isso ataca especificamente "resposta dos botões"
 * (o pedido do usuário): marcar 1 episódio não deveria custar 20+
 * blurs de novo.
 *
 * CORREÇÃO: cada linha virou este componente próprio, embrulhado em
 * `React.memo`. Junto com `handleEpisodePress`/`handleOpenEpisode`
 * virando `useCallback` (acima, em `SeasonAccordion`) — funções
 * estáveis são pré-requisito pro `memo` funcionar, senão toda re-
 * renderização do pai cria uma função nova, invalidando o `memo` de
 * novo — agora só o `isWatched` da linha tocada muda entre renders,
 * então só ELA re-renderiza (e só o blur DELA é recalculado). As
 * outras linhas da temporada aberta ficam intocadas.
 *
 * SEM MUDANÇA VISUAL: o JSX, os estilos (`styles.episodeCard` etc., o
 * mesmo objeto `styles` do arquivo) e o comportamento (navegação pro
 * Detalhes do Episódio ao tocar no texto/imagem, botão redondo marca/
 * desmarca sem navegar) são idênticos ao bloco original — só a forma
 * de renderizar mudou.
 */
const SeasonEpisodeRow = memo(function SeasonEpisodeRow({
  episode,
  isWatched,
  categoryColor,
  onOpenEpisode,
  onToggleWatched,
}: {
  episode: Episode;
  isWatched: boolean;
  categoryColor?: string;
  onOpenEpisode: (episodeNumber: number) => void;
  onToggleWatched: (episodeNumber: number, isWatched: boolean) => void;
}) {
  const { t } = useTranslation();
  const stillUrl = tmdbImageUrl(episode.stillPath, "w300"); // o web usa `w300`; a miniatura tem 96dp (252px reais), `w185` ficava macia

  return (
    /*
      PORTE DO WEB (2026-09-09, comparado no print) — cada episódio era
      uma LINHA nua, separada da seguinte por um fio, dentro de um
      bloco sem recheio. No web (`EpisodeCard.tsx`) cada episódio é um
      CARD DE VIDRO próprio — `rounded-2xl border border-white/10 p-2
      backdrop-blur-[18px] backdrop-saturate-[180%]` + brilho 0.17 /
      base 0.10, a receita `card` do `Glass` — com 8 de distância pro
      card seguinte.
    */
    <Glass style={styles.episodeCard}>
      <Pressable style={styles.episodeTouchArea} onPress={() => onOpenEpisode(episode.episodeNumber)}>
        <View style={styles.stillWrapper}>
          {stillUrl ? (
            <Image source={{ uri: stillUrl }} style={styles.still} contentFit="cover" />
          ) : (
            <Text numberOfLines={2} variant="muted" style={styles.stillFallback}>
              {t("episode.noImage")}
            </Text>
          )}
        </View>
        <View style={styles.episodeInfo}>
          {/*
            O número saiu de dentro do título ("1. O Caipira...") e
            virou uma linha PRÓPRIA acima dele, em cinza — é como o web
            mostra ("Episódio 1"), e é o que faz o título do episódio
            ganhar destaque de verdade.
          */}
          <Text variant="muted" style={styles.episodeNumber}>
            {t("episode.numberLabel", { number: episode.episodeNumber })}
          </Text>
          <Text numberOfLines={1} style={styles.episodeTitle}>
            {episode.name}
          </Text>
          {/* Faltava a DURAÇÃO: o web mostra "24 min · 2025-04-05", o mobile só a data. */}
          <Text variant="muted" style={styles.episodeMeta}>
            {[episode.runtimeMinutes ? `${episode.runtimeMinutes} min` : null, episode.airDate ?? null].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </Pressable>
      <EpisodeWatchedButton
        watched={isWatched}
        onPress={() => onToggleWatched(episode.episodeNumber, isWatched)}
        color={categoryColor}
        pulseOnConfirm
      />
    </Glass>
  );
});

/** Monta título/mensagem/ações de cada um dos 3 diálogos possíveis — mantém o corpo do componente mais legível. */
function buildDialogProps(
  dialog: Dialog,
  handlers: {
    onMarkUpTo: (episodeNumber: number) => void;
    onMarkOnlyThis: (episodeNumber: number) => void;
    onUnwatch: (episodeNumber: number) => void;
    onRewatch: (episodeNumber: number) => void;
    onConfirmSeasonToggle: (includeEarlierSeasons: boolean) => void;
    allWatched: boolean;
    /** A PEDIDO (2026-09-17) — quantas temporadas ANTERIORES a esta ainda têm episódio pendente. Só muda o diálogo de "marcar temporada" quando > 0. */
    earlierPendingSeasonsCount: number;
  },
  t: TFunction
): { title: string; message?: string; actions: OptionSheetAction[] } | null {
  if (!dialog) return null;

  if (dialog.type === "mark-previous") {
    return {
      title: t("episode.markPreviousTitle"),
      message: t("episode.markPreviousMessage"),
      actions: [
        { label: t("common.yes"), active: true, onPress: () => handlers.onMarkUpTo(dialog.episodeNumber) },
        { label: t("common.no"), onPress: () => handlers.onMarkOnlyThis(dialog.episodeNumber) },
      ],
    };
  }

  if (dialog.type === "watched-actions") {
    return {
      title: t("episode.markAs"),
      actions: [
        { label: t("episode.notWatchedAction"), onPress: () => handlers.onUnwatch(dialog.episodeNumber) },
        { label: t("episode.rewatchedAction"), onPress: () => handlers.onRewatch(dialog.episodeNumber) },
      ],
    };
  }

  // season-toggle
  /*
   * A PEDIDO (2026-09-17 — "quando marco a temporada 3, deveria
   * perguntar se quero marcar as anteriores também") — só ao MARCAR
   * (nunca ao desmarcar, o usuário só pediu isso pra marcar) e só
   * quando existe pelo menos uma temporada anterior com episódio
   * pendente: troca o botão único de "Confirmar" por duas opções, igual
   * ao diálogo irmão de "marcar episódios anteriores" (`mark-previous`,
   * acima) — "Sim" marca esta temporada MAIS as anteriores pendentes;
   * "Não" mantém o comportamento de sempre (só esta temporada).
   */
  if (!handlers.allWatched && handlers.earlierPendingSeasonsCount > 0) {
    return {
      title: t("episode.markPreviousSeasonsTitle"),
      message: t("episode.markPreviousSeasonsMessage"),
      actions: [
        { label: t("common.yes"), active: true, onPress: () => handlers.onConfirmSeasonToggle(true) },
        { label: t("common.no"), onPress: () => handlers.onConfirmSeasonToggle(false) },
      ],
    };
  }

  return {
    title: handlers.allWatched ? t("episode.unmarkSeasonTitle") : t("episode.markSeasonTitle"),
    message: handlers.allWatched ? t("episode.unmarkSeasonMessage") : t("episode.markSeasonMessage"),
    actions: [{ label: t("common.confirm"), active: true, onPress: () => handlers.onConfirmSeasonToggle(false) }],
  };
}

/**
 * A LUZ QUE O DESFOQUE DO MOBILE NÃO TEM DE ONDE PUXAR (2026-09-09,
 * medido no print do usuário, não estimado).
 *
 * Medições, no mesmo lugar dos dois lados — o vão ENTRE dois cards
 * (que mostra o fundo do acordeão) e o corpo do card, fora do brilho
 * de canto:
 *
 *                 fundo do acordeão      card do episódio
 *     web            (24, 36, 49)          (58,  87, 111)
 *     mobile         (25, 35, 47)          (40,  60,  80)
 *
 * O FUNDO bate nos dois — então o vidro do acordeão está certo. E o
 * card do mobile bate, até o nível de ruído, com o que a receita
 * `card` prevê a partir desse fundo: `(L + 1.8·(C−L))·0.9 + 25.5` =
 * (42, 58, 77). Ou seja a receita está aplicada corretamente; o que
 * falta não é calibração dela, é LUZ CHEGANDO.
 *
 * De onde vem essa luz no web: o `backdrop-filter` de raio 18px do
 * card amostra a PÁGINA JÁ COMPOSTA num raio de 18px em volta — e ali
 * estão o vidro do acordeão e os cards vizinhos, todos claros. A pilha
 * inteira se auto-ilumina. No mobile o `blurTarget` é a
 * `BlurTargetView` do `GlassTargetProvider` da tela, que contém APENAS
 * o campo de manchas sobre a base escura: os cards vizinhos e o vidro
 * do acordeão não estão lá dentro, então não existe nada de claro para
 * o desfoque puxar. Não dá pra colocá-los no alvo — um `BlurView`
 * dentro da `BlurTargetView` que ele desfoca é o ciclo que trava o
 * app (SIGSEGV, ver `components/ui/Glass.tsx`).
 *
 * Então a luz entra como camada, no lugar exato onde ela entraria: o
 * `Glass` desenha o `backgroundColor` do chamador ENTRE o desfoque e a
 * base da receita. O valor abaixo é o que leva o desfoque saturado
 * medido (18, 36, 58) até (36, 68, 95) — que, depois do branco 10% da
 * receita, dá exatamente o (58, 87, 111) do web.
 *
 * LIMITE CONHECIDO, registrado de propósito: isto é uma camada de cor
 * FIXA, e a luz do web acompanha a mancha de fundo. Onde a mancha for
 * mais fraca que neste print, o card vai ficar um pouco mais azul que
 * o do web. A correção sem esse limite exigiria o alvo de desfoque
 * incluir a própria pilha de cards, que é justamente o ciclo proibido.
 */
const LUZ_DA_PILHA = "rgba(90,165,207,0.25)";

const styles = StyleSheet.create({
  /**
   * PORTE DO WEB (2026-09-09) — era um bloco SÓLIDO. O
   * `SeasonAccordion.tsx` do web usa
   * `rounded-lg border border-white/10 backdrop-blur-[10px] backdrop-saturate-[160%]`,
   * que é a receita `light` do `Glass` (desfoque 10px, brilho 0.13,
   * base 0.06 — e a saturação 1.6 que essa receita já carrega).
   * Borda e fundo saíram daqui porque quem desenha agora é o `Glass`.
   */
  wrapper: {
    borderRadius: 8, // `rounded-lg` (era `radius.md` = 10)
    overflow: "hidden",
  },
  /** `flex w-full items-center gap-3 px-4 py-3` = 12 entre as partes, 16/12 de recheio (a vertical era 16). */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  /** No web o chevron faz parte do BOTÃO que abre o acordeão, não é um ícone solto ao lado. */
  headerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  /** `text-sm font-medium` = 14/500 (era `variant="label"` = 14/600). */
  seasonName: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  chevronAberto: {
    transform: [{ rotate: "180deg" }],
  },
  /** `mt-1.5 w-full` do `SeasonProgress.tsx`. */
  progressBlock: {
    marginTop: 6,
    width: "100%",
  },
  /** `mb-1 flex items-center justify-between text-xs text-muted`. */
  progressLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: fontSize.xs,
  },
  /** Cor vem por fora (inline) — usa a cor da categoria da série, ver `categoryColor` acima (antes fixo em `colors.primary`, bug real corrigido 2026-09-15). */
  progressPercent: {
    fontSize: fontSize.xs,
  },
  /** `h-1.5 w-full overflow-hidden rounded-full bg-border` (`ProgressBar.tsx`). */
  progressTrack: {
    height: 6,
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  /* `backgroundColor` sai por fora (inline) — usa a cor da categoria da série. */
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  /** `space-y-2 border-t border-border p-3` = 8 entre os cards, 12 de recheio (não tinha recheio nenhum). */
  episodeList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 12,
    gap: spacing.sm,
  },
  /** `rounded-2xl ... p-2` com `gap-3` — borda e fundo vêm do `Glass`. */
  episodeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.lg, // `rounded-2xl`
    padding: spacing.sm,
    /* O `Glass` extrai o `backgroundColor` do estilo e o desenha ENTRE o desfoque e a base da receita — ver `LUZ_DA_PILHA`, acima. */
    backgroundColor: LUZ_DA_PILHA,
  },
  episodeTouchArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },
  /** `h-14 w-24 rounded-md bg-background` = 96 × 56, canto 6 (era 64 × 40). */
  stillWrapper: {
    width: 96,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  still: {
    width: "100%",
    height: "100%",
  },
  /** `text-[10px] text-muted` centralizado — o web escreve "Sem imagem", não desenha um ícone. */
  stillFallback: {
    fontSize: 10,
    textAlign: "center",
  },
  /** Sem `gap`: no web são três `<p>` seguidos (margem zero), e só o terceiro tem `mt-0.5`. */
  episodeInfo: {
    flex: 1,
    minWidth: 0,
  },
  /** `text-xs text-muted`. */
  episodeNumber: {
    fontSize: fontSize.xs,
  },
  /** `truncate text-sm font-medium` = 14/500 (era 600). */
  episodeTitle: {
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  /** `mt-0.5 text-xs text-muted` = 2 de topo, 12px (era 11 e sem margem). */
  episodeMeta: {
    marginTop: 2,
    fontSize: fontSize.xs,
  },
});
