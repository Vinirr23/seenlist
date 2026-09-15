import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { MediaSearchResult } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Text, PressableScale, Glass } from "@/components/ui";
import { colors, fontSize } from "@/lib/theme";

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
 */
export function SimilarTitlesCarousel({ items }: { items: MediaSearchResult[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  if (items.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => {
        const posterUrl = tmdbImageUrl(item.posterPath, "w342");
        const href = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
        const hasRating = item.voteAverage != null && item.voteAverage > 0;
        return (
          <PressableScale key={`${item.mediaType}-${item.id}`} style={styles.card} onPress={() => router.push(href)}>
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
      })}
    </ScrollView>
  );
}

const CARD_WIDTH = 128; // `w-32` (era 104)

const styles = StyleSheet.create({
  /** `flex gap-3 ... pb-1` = 12 entre os cards, 4 de folga embaixo (era `spacing.sm` = 8, sem folga). */
  row: {
    flexDirection: "row",
    gap: 12,
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
    /* `rounded-lg` = 8 no web; aqui era `radius.md` = 10. */
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  noPoster: {
    fontSize: 10,
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
  rating: {
    fontSize: 11,
    color: colors.primary,
  },
  dot: {
    fontSize: 11,
    marginHorizontal: 3,
  },
  year: {
    fontSize: 11,
  },
});
