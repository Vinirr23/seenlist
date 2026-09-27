import { useEffect, useState } from "react";
import { FlatList, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { MediaSearchResult } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { fetchLibraryStatusesFor } from "@/lib/discover";
import { AddToLibraryButton } from "@/components/explore/AddToLibraryButton";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Text, PressableScale, Glass } from "@/components/ui";
import { colors, fontSize, radius } from "@/lib/theme";

/**
 * TASK-100 — porta de `SimilarTitlesCarousel.tsx` do web
 * (`components/media/`, já compartilhado lá entre `SimilarMoviesCarousel`
 * e `SimilarSeriesCarousel` — aqui nem precisou de dois wrappers,
 * um componente só serve os dois). Os dados (`series.similar`/
 * `movie.similar`) já vêm de graça na mesma resposta que os detalhes
 * — nenhuma chamada nova precisou ser feita.
 *
 * CORREÇÃO (a pedido — auditoria mais rigorosa) — faltava a nota +
 * ano embaixo do título (`voteAverage`/`year`, o mesmo dado já vem
 * junto, só não era mostrado) — o web tem desde o refinamento da aba
 * Sobre.
 *
 * REDESENHO (mockup aprovado 2026-09-25, pedido explícito do usuário
 * — "em filmes parecidos eles não tem o (+) que tem nos posters de
 * explorar, adiciona") — mesmo `AddToLibraryButton.tsx` e mesma busca
 * em lote (`fetchLibraryStatusesFor`, 1 consulta pra todos os itens
 * visíveis) que `DiscoverCarousel.tsx` já usa em Explorar; cada
 * pôster nasce sabendo se mostra "+" ou "✓", sem atraso individual.
 */
export function SimilarTitlesCarousel({ items }: { items: MediaSearchResult[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) return;
    fetchLibraryStatusesFor(items.map((item) => ({ mediaType: item.mediaType, id: item.id }))).then((data) => {
      if (!cancelled) setStatuses(data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mesma regra de `DiscoverCarousel.tsx`: refazer a busca a cada render por causa de um array `items` novo (mesmo conteúdo) só gastaria consulta à toa; `movie.similar`/`series.similar` não mudam depois do primeiro carregamento da tela.
  }, [items.map((item) => `${item.mediaType}-${item.id}`).join(",")]);

  if (items.length === 0) return null;

  return (
    /*
     * CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance —
     * item 6.1: "Cast/Similar → FlatList") — era `ScrollView` +
     * `.map()`, mesmo padrão já corrigido em `EpisodeCarousel.tsx`
     * (TASK-162) e `DiscoverCarousel.tsx`: desenha TODOS os cards de
     * "parecidos" de uma vez, sem limite (o TMDB pode devolver até
     * ~20 títulos). `FlatList` virtualiza; `getItemLayout` (todo card
     * tem `CARD_WIDTH` fixo) evita medir nada. Nenhuma mudança visual:
     * mesmos estilos, mesma ordem, mesmo conteúdo por card.
     */
    <FlatList
      data={items}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(item) => `${item.mediaType}-${item.id}`}
      contentContainerStyle={styles.row}
      getItemLayout={(_, index) => ({
        length: CARD_WIDTH + ROW_GAP,
        offset: (CARD_WIDTH + ROW_GAP) * index,
        index,
      })}
      initialNumToRender={6}
      windowSize={5}
      maxToRenderPerBatch={8}
      renderItem={({ item }) => {
        const posterUrl = tmdbImageUrl(item.posterPath, "w342");
        const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
        const hasRating = item.voteAverage != null && item.voteAverage > 0;
        return (
          <PressableScale style={styles.card} onPress={() => router.push(href)}>
            <Glass style={styles.posterWrapper} variant="medium">
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
              ) : (
                <View style={styles.posterFallback}>
                  {/* PORTE DO WEB (2026-09-09) — o vazio no web não é ícone: é o texto "Sem pôster" (`media.noPoster`) em 10px, centralizado. */}
                  <Text numberOfLines={2} variant="muted" style={styles.noPoster}>
                    {t("media.noPoster")}
                  </Text>
                </View>
              )}
              <AddToLibraryButton
                mediaType={item.mediaType}
                mediaId={item.id}
                initialStatus={statuses.get(`${item.mediaType}-${item.id}`) ?? null}
              />
            </Glass>
            <Text numberOfLines={1} style={styles.title}>
              {item.title}
            </Text>
            {(hasRating || item.year) && (
              <View style={styles.metaRow}>
                {hasRating && (
                  <View style={styles.ratingRow}>
                    <MaterialCommunityIcons name="star" size={10} color={colors.primary} />
                    <Text style={styles.rating}>{item.voteAverage!.toFixed(1)}</Text>
                  </View>
                )}
                {hasRating && item.year ? <Text variant="muted" style={styles.dot}>·</Text> : null}
                {!!item.year && (
                  <Text variant="muted" style={styles.year}>
                    {item.year}
                  </Text>
                )}
              </View>
            )}
          </PressableScale>
        );
      }}
    />
  );
}

const CARD_WIDTH = 128; // `w-32` (era 104)
const ROW_GAP = 12; // `flex gap-3` — mesmo valor de `styles.row.gap`, extraído só para alimentar `getItemLayout` da `FlatList` (CORREÇÃO DE DESEMPENHO, 2026-09-27).

const styles = StyleSheet.create({
  /** `flex gap-3 ... pb-1` = 12 entre os cards, 4 de folga embaixo (era `spacing.sm` = 8, sem folga). */
  row: {
    flexDirection: "row",
    gap: ROW_GAP,
    paddingBottom: 4,
  },
  card: {
    width: CARD_WIDTH,
  },
  /**
   * PORTE DO WEB (2026-09-09) — era um retângulo SÓLIDO
   * (`colors.surface`). No `SimilarTitlesCarousel.tsx` do web esta caixa é vidro:
   * `border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]`
   * — a receita `medium` do `Glass` (`glassVariants` em `lib/theme.ts`:
   * desfoque 14px, brilho 0.16, base 0.09).
   *
   * O vidro fica na CAIXA DA IMAGEM mesmo, não num contêiner em volta:
   * é ela que aparece enquanto o pôster/logo carrega, ou quando não
   * existe. `backgroundColor` saiu porque quem pinta agora é o `Glass`.
   */
  posterWrapper: {
    width: CARD_WIDTH,
    aspectRatio: 2 / 3,
    /* `rounded-lg` = 8 no web = `radius.poster` (FASE 2, 2026-09-26 — token formalizado). */
    borderRadius: radius.poster,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.micro` (era literal 10, mesmo valor).
  noPoster: {
    fontSize: fontSize.micro,
    textAlign: "center",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  /** `mt-1.5 text-xs font-medium` = 6 de topo e peso 500 (era 4 e peso 600). */
  title: {
    marginTop: 6,
    fontSize: fontSize.xs,
    fontWeight: "500",
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (eram literais 11, mesmo valor).
  rating: {
    fontSize: fontSize.xxs,
    color: colors.primary,
  },
  dot: {
    fontSize: fontSize.xxs,
    marginHorizontal: 3,
  },
  year: {
    fontSize: fontSize.xxs,
  },
});
