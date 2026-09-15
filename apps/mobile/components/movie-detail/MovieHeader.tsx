import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { MovieDetails } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Glass, GlassTargetProvider } from "@/components/ui";
import { colors, radius, spacing, fontSize, elevation } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-10, achado numa auditoria pedida —
 * "você está sempre pulando os botões de cima e as folhas") — este
 * arquivo nunca tinha recebido a mesma passada de vidro que
 * `SeriesHeader.tsx` já tinha (mtime bem mais antigo que o resto da
 * pasta `movie-detail/`, nunca tocado nesta rodada inteira de portes).
 * Os dois botões (voltar/"...") eram círculos CHAPADOS
 * (`scrim.overImage`), sem o mesmo problema já resolvido em
 * `SeriesHeader.tsx` ("os botões não estão transparentes" — ver o
 * comentário completo lá pra causa raiz): um `Glass` sem alvo próprio
 * usava o contexto do `GlassTargetProvider` da TELA (campo de manchas
 * sobre base opaca), nunca a capa em si. Mesmo fix: `GlassTargetProvider`
 * LOCAL com `base="transparent"` e a capa como `background` — os
 * `Glass` de dentro passam a desfocar a foto de verdade, igual ao web.
 *
 * Também estava faltando: o véu era chapado (agora é degradê, igual
 * ao web `bg-gradient-to-t from-background via-background/70
 * to-background/10`); a capa era `w780`/180 de altura (web é `h-56` =
 * 224, mesma correção de resolução já aplicada em `SeriesHeader.tsx`);
 * e a caixa do pôster era um retângulo sólido — no web
 * (`rounded-lg border border-white/10 backdrop-blur-[14px]
 * backdrop-saturate-[180%]` + brilho 0.16/base 0.09) é a receita
 * `medium` do `Glass`.
 */
export function MovieHeader({
  movie,
  watched,
  onMorePress,
}: {
  movie: MovieDetails;
  watched: boolean;
  onMorePress: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const backdropUrl = tmdbImageUrl(movie.backdropPath, "w1280"); // era `w780` — o web usa `w1280`, esticado até 1080px de tela ficava macio
  const posterUrl = tmdbImageUrl(movie.posterPath, "w342");
  const year = movie.releaseDate ? movie.releaseDate.slice(0, 4) : null;

  return (
    <View>
      <GlassTargetProvider
        style={styles.backdropWrapper}
        base="transparent"
        background={
          <>
            {backdropUrl ? (
              <Image source={{ uri: backdropUrl }} style={styles.backdrop} contentFit="cover" />
            ) : (
              <View style={[styles.backdrop, styles.backdropFallback]} />
            )}
            {/** `bg-gradient-to-t from-background via-background/70 to-background/10` — quase transparente em cima, chapado embaixo. */}
            <LinearGradient
              colors={["rgba(11,14,20,0.1)", "rgba(11,14,20,0.7)", colors.background]}
              locations={[0, 0.5, 1]}
              style={styles.overlay}
            />
          </>
        }
      >
        <Glass style={styles.backButton} variant="icon">
          <Pressable style={styles.buttonHit} onPress={() => router.back()} hitSlop={8}>
            <Feather name="arrow-left" size={16} color={colors.text} />
          </Pressable>
        </Glass>

        <Glass style={styles.moreButton} variant="icon">
          <Pressable style={styles.buttonHit} onPress={onMorePress} hitSlop={8}>
            <Feather name="more-horizontal" size={16} color={colors.text} />
          </Pressable>
        </Glass>
      </GlassTargetProvider>

      <View style={styles.headerRow}>
        <Glass style={styles.posterWrapper} variant="medium">
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
          ) : (
            <View style={styles.posterFallback}>
              <Feather name="film" size={20} color={colors.muted} />
            </View>
          )}
          {watched && (
            <View style={styles.watchedBadge}>
              <Feather name="check" size={10} color={colors.background} />
              <Text style={styles.watchedBadgeText}>{t("action.watched")}</Text>
            </View>
          )}
        </Glass>

        <View style={styles.info}>
          <Text variant="subtitle" numberOfLines={2}>
            {movie.title}
          </Text>
          {movie.originalTitle !== movie.title && (
            <Text variant="muted" numberOfLines={1} style={styles.originalTitle}>
              {movie.originalTitle}
            </Text>
          )}
          <Text variant="muted" style={styles.meta}>
            {[year, movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : null].filter(Boolean).join(" · ")}
          </Text>
          {movie.genres.length > 0 && (
            <Text variant="muted" numberOfLines={1} style={styles.meta}>
              {movie.genres.join(", ")}
            </Text>
          )}
          <View style={styles.ratingRow}>
            {/* Precisa ser PREENCHIDA (`fill-primary` no web) — `Feather` só tem contorno; `MaterialCommunityIcons` "star" já vem sólida. */}
            <MaterialCommunityIcons name="star" size={15} color={colors.primary} />
            <Text style={styles.rating}>{movie.voteAverage.toFixed(1)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const POSTER_WIDTH = 96;
const POSTER_HEIGHT = 144;

const styles = StyleSheet.create({
  /** `h-56` = 224 no web; era 180. */
  backdropWrapper: {
    height: 224,
    width: "100%",
    backgroundColor: colors.surface,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropFallback: {
    backgroundColor: colors.surface,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  /** `left-3 top-3 h-9 w-9` = 12 de canto (era `spacing.md` = 16), 36 de lado — mesma medida de `SeriesHeader.tsx`. */
  backButton: {
    position: "absolute",
    left: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  moreButton: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
    ...elevation.medium,
  },
  buttonHit: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  headerRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginTop: -POSTER_HEIGHT / 2.2,
  },
  posterWrapper: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  watchedBadge: {
    position: "absolute",
    right: 4,
    top: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  watchedBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.background,
  },
  info: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: spacing.xs,
    gap: 2,
  },
  originalTitle: {
    fontSize: 11,
  },
  meta: {
    fontSize: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.xs,
  },
  rating: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.primary,
  },
});
