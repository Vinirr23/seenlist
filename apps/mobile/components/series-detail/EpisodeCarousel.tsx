import { memo, useCallback, useEffect, useRef } from "react";
import { FlatList, View, Pressable, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { LibraryStatus, SeriesDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { isEpisodeWatchedSync, resolveCarouselEpisodes, type EpisodeRef, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import type { SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { Text, Glass } from "@/components/ui";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type CarouselItem =
  | ({ kind: "episode" } & EpisodeRef)
  | { kind: "caught-up"; badge: Exclude<SeriesCaughtUpBadge, null> };

export function EpisodeCarousel({
  seriesId,
  category,
  seasons,
  watched,
  watchedEpisodeIds,
  onToggleEpisode,
  caughtUpBadge,
  categoryColor,
}: {
  seriesId: number;
  category: LibraryStatus | null | undefined;
  seasons: SeriesDetails["seasons"];
  watched: Set<WatchedEpisodeKey>;
  /** CORREÇÃO (2026-08-26 — "motor resistente") — opcional, ver `isEpisodeWatchedSync` (seriesDetails.ts). */
  watchedEpisodeIds?: Set<number>;
  /** `episodeId` opcional (2026-08-26, "motor resistente" — ver seriesDetails.ts). */
  onToggleEpisode: (seasonNumber: number, episodeNumber: number, episodeId?: number) => void;
  /** TASK-170 (ajuste — a pedido) — o card "mais episódios a caminho"/"série encerrada" mora aqui, não depois das temporadas (diferente do web, decisão explícita pro mobile). */
  caughtUpBadge?: SeriesCaughtUpBadge;
  /**
   * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-15 — "no web, ao colocar
   * uma série em 'assistir depois' fica da cor certa do status, no
   * mobile não está") — os botões redondos de "assistido" deste
   * carrossel sempre usavam `colors.primary` fixo. Cor da categoria
   * ATUAL da série (`getSeriesCategoryColorByStatus`,
   * `lib/seriesCategories.ts`), calculada uma vez em
   * `app/series/[id].tsx` e repassada pra cá — mesmo padrão do
   * `colorClass` no `EpisodeCarousel.tsx` do web.
   */
  categoryColor?: string;
}) {
  const { t } = useTranslation();
  const episodeItems = resolveCarouselEpisodes(category, seasons, watched);
  /** TASK-170 (ajuste — a pedido, "não é pra tirar a rolagem, é pra incluir no final") — mesma FlatList horizontal de sempre, só com um card a mais no final quando a série está em dia/encerrada, no mesmo tamanho dos cards de episódio. */
  const data: CarouselItem[] = [
    ...episodeItems.map((item) => ({ kind: "episode" as const, ...item })),
    ...(caughtUpBadge ? [{ kind: "caught-up" as const, badge: caughtUpBadge }] : []),
  ];
  const listRef = useRef<FlatList<CarouselItem>>(null);
  const renderedSeriesId = useRef<number | null>(null);
  const hasUserScrolled = useRef(false);

  // Ao trocar de série, reseta o controle de "usuário já mexeu na lista manualmente".
  if (renderedSeriesId.current !== seriesId) {
    renderedSeriesId.current = seriesId;
    hasUserScrolled.current = false;
  }

  /**
   * TASK-157/158/159/160/161 (correção definitiva — instável) — ao
   * abrir a tela, a lista horizontal de episódios já abre
   * posicionada no primeiro episódio ainda não marcado como
   * assistido, em vez de sempre começar do episódio 1.
   *
   * Causa raiz de verdade, confirmada com dado real do banco
   * (TASK-161): `onContentSizeChange` só dispara quando o TAMANHO da
   * lista muda — e o tamanho não depende de quais episódios estão
   * marcados como assistidos, só de quantos episódios existem. Se os
   * dados de "assistido" (`watched`, que vem de uma busca separada,
   * assíncrona) ainda não tinham chegado no instante em que a lista
   * terminou de desenhar, a tentativa de rolagem via
   * `onContentSizeChange` calculava a posição com `watched` ainda
   * VAZIO — e como o tamanho da lista não muda depois que os dados
   * de verdade chegam, nunca disparava de novo.
   *
   * Agora: a mesma função de tentativa (`attemptScroll`) é chamada
   * tanto quando o LAYOUT fica pronto (`onContentSizeChange`) quanto
   * toda vez que `watched` muda de verdade (novo resultado da busca)
   * — cobre os dois lados da corrida, não importa qual dos dois
   * chega primeiro.
   */
  function attemptScroll() {
    if (episodeItems.length === 0) return;
    const firstUnwatchedIndex = episodeItems.findIndex(
      ({ seasonNumber, episode }) => !isEpisodeWatchedSync(watched, seasonNumber, episode.episodeNumber, episode.id, watchedEpisodeIds)
    );

    // TASK-173 (achado real, a pedido — "a rolagem recua" ao marcar o
    // último episódio) — quando não sobra episódio não assistido, a
    // rolagem pro card final SEMPRE acontece, mesmo que
    // `hasUserScrolled` já esteja true. Esse guard existe pra não
    // brigar com o usuário navegando livremente pelo carrossel — mas
    // no caso mais comum de todos, marcar o ÚLTIMO episódio exige
    // rolar até ele primeiro, o que já deixava `hasUserScrolled` true
    // e cancelava a rolagem final logo depois, bem na hora que ela
    // mais fazia sentido (mostrar o card de recompensa). Terminar a
    // série é um momento deliberado — vale a pena rolar de qualquer
    // jeito, diferente de "pular pro primeiro não assistido" (que
    // continua respeitando o usuário navegando por conta própria).
    if (firstUnwatchedIndex === -1) {
      if (data.length > 1) {
        listRef.current?.scrollToOffset({ offset: (data.length - 1) * (CARD_WIDTH + GAP), animated: true });
      }
      return;
    }

    if (hasUserScrolled.current) return;
    if (firstUnwatchedIndex > 0) {
      listRef.current?.scrollToOffset({ offset: firstUnwatchedIndex * (CARD_WIDTH + GAP), animated: false });
    }
  }

  useEffect(() => {
    attemptScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, watched, watchedEpisodeIds]);

  if (data.length === 0) return null;

  return (
    <View>
      {/*
        PORTE DO WEB (2026-09-09) — o título era `variant="subtitle"`
        (18px/600). No `EpisodeCarousel.tsx` do web ele é
        `mb-2 text-sm font-medium` = 14px/500, igualzinho aos títulos
        de "Trailer"/"Elenco"/"Galeria" da aba Sobre.
      */}
      <Text style={styles.title}>{t("seriesHome.episodesTab")}</Text>
      {/**
       * TASK-162 (a pedido — desempenho em séries com muitos
       * episódios) — antes usava `ScrollView` + `.map()`, que desenha
       * TODOS os cards de uma vez, não importa quantos episódios a
       * série tenha (testado com uma série de 89 episódios — 89 cards
       * montados na memória de uma vez só, mesmo só uns 3-4
       * aparecendo na tela). `FlatList` só desenha o que está perto
       * da área visível (virtualização) — `getItemLayout` (todo card
       * tem a mesma largura) permite calcular a posição de rolagem
       * automática sem precisar medir nada, então a correção de
       * abrir já no episódio certo continua funcionando igual.
       */}
      <FlatList
        ref={listRef}
        data={data}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) =>
          item.kind === "episode" ? `${item.seasonNumber}-${item.episode.episodeNumber}` : `caught-up-${index}`
        }
        style={styles.list}
        contentContainerStyle={styles.row}
        getItemLayout={(_, index) => ({ length: CARD_WIDTH + GAP, offset: (CARD_WIDTH + GAP) * index, index })}
        initialNumToRender={6}
        windowSize={5}
        maxToRenderPerBatch={8}
        onContentSizeChange={attemptScroll}
        onScrollBeginDrag={() => {
          hasUserScrolled.current = true;
        }}
        renderItem={({ item }) =>
          item.kind === "episode" ? (
            <EpisodeCarouselCard
              seriesId={seriesId}
              seasonNumber={item.seasonNumber}
              episodeNumber={item.episode.episodeNumber}
              episodeId={item.episode.id}
              episodeName={item.episode.name}
              stillPath={item.episode.stillPath}
              isWatched={isEpisodeWatchedSync(watched, item.seasonNumber, item.episode.episodeNumber, item.episode.id, watchedEpisodeIds)}
              onToggleEpisode={onToggleEpisode}
              categoryColor={categoryColor}
            />
          ) : (
            <CaughtUpMiniCard badge={item.badge} />
          )
        }
      />
    </View>
  );
}

/*
 * CORREÇÃO DE CAUSA RAIZ (2026-09-17, a pedido — "desmarcar e marcar
 * episódio na tela de detalhes ainda está lento", medido de verdade
 * com `performance.now()` — ver o diagnóstico entregue ao usuário) —
 * o próprio React Native denunciou o culpado sozinho, sem precisar
 * adivinhar: `VirtualizedList: You have a large list that is slow to
 * update`, com `dt` de mais de 500ms (chegou a 2717ms num caso). Esta
 * é a `FlatList` horizontal do carrossel de episódios, a ÚNICA lista
 * pesada da tela que nunca tinha ganho a memoização que
 * `SeasonAccordion.tsx` já tem (`SeasonEpisodeRow`, `memo`) — cada
 * toque em QUALQUER episódio (do carrossel OU do acordeão, já que os
 * dois lêem o mesmo `watched`) recriava a árvore inteira do carrossel
 * inline no `.map()`/`renderItem`, e o React redesenhava TODOS os
 * cards visíveis de novo, não só o tocado.
 *
 * Duas causas, as duas resolvidas juntas (uma sozinha não bastaria,
 * mesma lição do `SeasonAccordion`/`watchedRef` — ver comentário
 * grande em `useSeriesDetails.ts`):
 *
 * 1. O card recebia o objeto `episode` INTEIRO como prop — vindo de
 *    `resolveCarouselEpisodes`, que monta um objeto/array NOVO a cada
 *    render (mesmo quando o conteúdo do episódio não mudou nada) — um
 *    `React.memo` comparando esse objeto por referência nunca bateria
 *    igual, então nunca pularia o re-render. Agora os campos que
 *    realmente importam (`episodeNumber`, `episodeId`, `episodeName`,
 *    `stillPath`) vêm como props PRIMITIVAS — aí sim o `memo` compara
 *    de verdade.
 * 2. `onToggle` era uma função NOVA por item a cada render do pai
 *    (`() => onToggleEpisode(...)`, criada dentro do `renderItem`) —
 *    invalidava o `memo` de todo card de novo, mesmo com o item #1
 *    corrigido. Agora quem recebe é `onToggleEpisode` direto (a
 *    própria `toggle`, já estável — ver `watchedRef` em
 *    `useSeriesDetails.ts`) e o card monta sua PRÓPRIA função estável
 *    por dentro, via `useCallback` com dependências primitivas.
 *
 * Resultado: só o card do episódio TOCADO muda de prop (`isWatched`)
 * e só ele re-renderiza — os outros, mesmo continuando montados pela
 * virtualização da `FlatList`, ficam intocados.
 */
const EpisodeCarouselCard = memo(function EpisodeCarouselCard({
  seriesId,
  seasonNumber,
  episodeNumber,
  episodeId,
  episodeName,
  stillPath,
  isWatched,
  onToggleEpisode,
  categoryColor,
}: {
  seriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  episodeId?: number;
  episodeName: string;
  stillPath: string | null;
  isWatched: boolean;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number, episodeId?: number) => void;
  categoryColor?: string;
}) {
  const router = useRouter();
  const stillUrl = tmdbImageUrl(stillPath, "w300"); // `w300` como no web — `w185` ficava borrado num card de 144dp (378px reais)
  const code = `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;

  const handleOpen = useCallback(
    () => router.push(`/episodes/${seriesId}/${seasonNumber}/${episodeNumber}`),
    [router, seriesId, seasonNumber, episodeNumber]
  );
  const handleToggle = useCallback(
    () => onToggleEpisode(seasonNumber, episodeNumber, episodeId),
    [onToggleEpisode, seasonNumber, episodeNumber, episodeId]
  );

  return (
    <View style={styles.card}>
      <Pressable onPress={handleOpen}>
        {/*
          PORTE DO WEB (2026-09-09) — a caixa da imagem era um
          retângulo SÓLIDO (`colors.surface`). No web é vidro:
          `rounded-lg border border-white/10 backdrop-blur-[14px]
          backdrop-saturate-[180%]` + brilho 0.16 / base 0.09 — a
          receita `medium` do `Glass`. O ícone do vazio também é
          outro: claquete (`Clapperboard`) de 20px em `muted/40`, não
          um "film" de 18px em `muted` cheio.
        */}
        <Glass style={styles.stillWrapper} variant="medium">
          {stillUrl ? (
            <Image source={{ uri: stillUrl }} style={styles.still} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name="movie-open-outline" size={20} color={ICONE_VAZIO} />
          )}
        </Glass>
        <Text style={styles.code}>{code}</Text>
        <Text numberOfLines={1} variant="muted" style={styles.name}>
          {episodeName}
        </Text>
      </Pressable>

      <View style={styles.watchedButtonRow}>
        <EpisodeWatchedButton watched={isWatched} onPress={handleToggle} size="sm" color={categoryColor} pulseOnConfirm />
      </View>
    </View>
  );
});

/** TASK-170 (ajuste) — mesmo tamanho/formato do `EpisodeCarouselCard` (CARD_WIDTH, `stillWrapper` no lugar da imagem), pra ficar visualmente parte da mesma fileira, não um banner destoante. */
function CaughtUpMiniCard({ badge }: { badge: Exclude<SeriesCaughtUpBadge, null> }) {
  const { t } = useTranslation();
  const isEnded = badge === "ended";
  return (
    <View style={styles.card}>
      <View style={[styles.stillWrapper, isEnded ? styles.miniCardEnded : styles.miniCardOngoing]}>
        <Feather name={isEnded ? "award" : "zap"} size={22} color={isEnded ? "#4ade80" : "#60a5fa"} />
      </View>
      <Text numberOfLines={2} style={styles.miniCardText}>
        {isEnded ? t("episode.seriesEnded") : t("episode.upToDateMoreComing")}
      </Text>
    </View>
  );
}

const CARD_WIDTH = 144; // `w-36`
/** `gap-3` = 12 no web; aqui era `spacing.sm` = 8. */
const GAP = 12;
/** `text-muted/40` — o `muted` (#8C93A8) a 40%. */
const ICONE_VAZIO = "rgba(140,147,168,0.4)";
/**
 * `font-mono` do web. O Tailwind não tem fonte monoespaçada
 * configurada neste projeto, então o `font-mono` cai na pilha padrão
 * dele (`ui-monospace, SFMono-Regular, Menlo, ...`) — ou seja, a
 * monoespaçada DO SISTEMA. O equivalente nativo é o nome que cada
 * plataforma dá pra ela.
 */
const FONTE_MONO = Platform.select({ ios: "Menlo", default: "monospace" });
/** `-mx-4 ... px-4` — a fileira sangra até a borda da tela e o recuo volta por dentro, então o primeiro card encosta na margem e os seguintes somem na borda ao rolar. */
const SANGRIA = spacing.md;

const styles = StyleSheet.create({
  /** `mb-2 text-sm font-medium text-text`. */
  title: {
    marginBottom: 8,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  list: {
    marginHorizontal: -SANGRIA,
  },
  row: {
    gap: GAP,
    paddingHorizontal: SANGRIA,
    paddingBottom: 4, // `pb-1`
  },
  card: {
    width: CARD_WIDTH,
  },
  stillWrapper: {
    width: CARD_WIDTH,
    aspectRatio: 16 / 9,
    /* `rounded-lg` = 8 no web; aqui era `radius.md` = 10. Fundo e borda vêm do `Glass`. */
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  still: {
    width: "100%",
    height: "100%",
  },
  /** `mt-1.5 font-mono text-xs font-semibold` = 6 de topo, 12px, peso 600 e fonte monoespaçada (era 4, peso 700 e fonte normal). */
  code: {
    marginTop: 6,
    fontSize: fontSize.xs,
    fontWeight: "600",
    fontFamily: FONTE_MONO,
    color: colors.text,
  },
  /** `text-xs text-muted` = 12 (era 11). */
  name: {
    fontSize: fontSize.xs,
  },
  watchedButtonRow: {
    marginTop: 6, // `mt-1.5`
    alignItems: "flex-start",
  },
  miniCardOngoing: {
    backgroundColor: "rgba(96,165,250,0.12)",
  },
  miniCardEnded: {
    backgroundColor: "rgba(74,222,128,0.12)",
  },
  miniCardText: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: colors.text,
    fontWeight: "600",
  },
});
