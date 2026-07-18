import { useEffect, useRef } from "react";
import { FlatList, View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryStatus, SeriesDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { episodeKey, resolveCarouselEpisodes, type EpisodeRef, type WatchedEpisodeKey } from "@/lib/seriesDetails";
import type { SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { Text } from "@/components/ui";
import { EpisodeWatchedButton } from "./EpisodeWatchedButton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

type CarouselItem =
  | ({ kind: "episode" } & EpisodeRef)
  | { kind: "caught-up"; badge: Exclude<SeriesCaughtUpBadge, null> };

export function EpisodeCarousel({
  seriesId,
  category,
  seasons,
  watched,
  onToggleEpisode,
  caughtUpBadge,
}: {
  seriesId: number;
  category: LibraryStatus | null | undefined;
  seasons: SeriesDetails["seasons"];
  watched: Set<WatchedEpisodeKey>;
  onToggleEpisode: (seasonNumber: number, episodeNumber: number) => void;
  /** TASK-170 (ajuste — a pedido) — o card "mais episódios a caminho"/"série encerrada" mora aqui, não depois das temporadas (diferente do web, decisão explícita pro mobile). */
  caughtUpBadge?: SeriesCaughtUpBadge;
}) {
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
    const firstUnwatchedIndex = episodeItems.findIndex(({ seasonNumber, episode }) => !watched.has(episodeKey(seasonNumber, episode.episodeNumber)));

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
  }, [seriesId, watched]);

  if (data.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={styles.title}>
        Episódios
      </Text>
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
              episode={item.episode}
              isWatched={watched.has(episodeKey(item.seasonNumber, item.episode.episodeNumber))}
              onToggle={() => onToggleEpisode(item.seasonNumber, item.episode.episodeNumber)}
            />
          ) : (
            <CaughtUpMiniCard badge={item.badge} />
          )
        }
      />
    </View>
  );
}

function EpisodeCarouselCard({
  seriesId,
  seasonNumber,
  episode,
  isWatched,
  onToggle,
}: {
  seriesId: number;
  seasonNumber: number;
  episode: EpisodeRef["episode"];
  isWatched: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const stillUrl = tmdbImageUrl(episode.stillPath, "w185");
  const code = `S${String(seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`;

  return (
    <View style={styles.card}>
      <Pressable onPress={() => router.push(`/episodes/${seriesId}/${seasonNumber}/${episode.episodeNumber}`)}>
        <View style={styles.stillWrapper}>
          {stillUrl ? (
            <Image source={{ uri: stillUrl }} style={styles.still} resizeMode="cover" />
          ) : (
            <Feather name="film" size={18} color={colors.muted} />
          )}
        </View>
        <Text style={styles.code}>{code}</Text>
        <Text numberOfLines={1} variant="muted" style={styles.name}>
          {episode.name}
        </Text>
      </Pressable>

      <View style={styles.watchedButtonRow}>
        <EpisodeWatchedButton watched={isWatched} onPress={onToggle} size="sm" />
      </View>
    </View>
  );
}

/** TASK-170 (ajuste) — mesmo tamanho/formato do `EpisodeCarouselCard` (CARD_WIDTH, `stillWrapper` no lugar da imagem), pra ficar visualmente parte da mesma fileira, não um banner destoante. */
function CaughtUpMiniCard({ badge }: { badge: Exclude<SeriesCaughtUpBadge, null> }) {
  const isEnded = badge === "ended";
  return (
    <View style={styles.card}>
      <View style={[styles.stillWrapper, isEnded ? styles.miniCardEnded : styles.miniCardOngoing]}>
        <Feather name={isEnded ? "award" : "zap"} size={22} color={isEnded ? "#4ade80" : "#60a5fa"} />
      </View>
      <Text numberOfLines={2} style={styles.miniCardText}>
        {isEnded ? "Série encerrada" : "Em dia! Mais episódios a caminho"}
      </Text>
    </View>
  );
}

const CARD_WIDTH = 144;
const GAP = spacing.sm;

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.sm,
  },
  row: {
    gap: GAP,
  },
  card: {
    width: CARD_WIDTH,
  },
  stillWrapper: {
    width: CARD_WIDTH,
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  still: {
    width: "100%",
    height: "100%",
  },
  code: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text,
  },
  name: {
    fontSize: 11,
  },
  watchedButtonRow: {
    marginTop: spacing.xs,
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
