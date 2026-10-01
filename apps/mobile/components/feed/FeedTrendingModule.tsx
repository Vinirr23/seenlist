import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { TrendingItem } from "@/lib/trending";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * "EM ALTA NO SEENLIST" (2026-10-01, documento de UX — "quebraria o
 * padrão do feed ocasionalmente (...) cria mudança de ritmo durante o
 * scroll"; REDESENHADO duas vezes no mesmo dia por feedback de
 * design):
 *
 * 1ª rodada, dois pontos:
 *   - "3 watching" repetido 3x parecia fraco/inventado com base de
 *     usuários ainda pequena. Tirado o número de verdade — a ORDEM
 *     (esquerda pra direita = mais watchers primeiro, já era assim)
 *     comunica popularidade sozinha, sem precisar inventar/expor
 *     volume. Virou um selo "🔥 Em alta" por item.
 *   - Faltava identificação do título — título de verdade embaixo do
 *     pôster, 1 linha + reticências.
 *
 * 2ª rodada (este comentário, a pedido) — o selo "🔥 Em alta" por item
 * (`feed.trendingBadge`) saiu: era redundante com o cabeçalho da
 * seção, que já diz "🔥 Trending on SeenList" uma vez só. Virou só
 * pôster + título, sem repetir "trending" 3 vezes na mesma tela
 * (`feed.trendingBadge`/`feed.trendingWatchers` ficam sem uso no
 * i18n, mesma convenção já usada nesta migração pra chaves que saem
 * de cena mas continuam traduzidas nos 3 idiomas).
 *
 * Cabeçalho usa um 🔥 literal (pedido explícito — "algo menos
 * técnico"); fica FORA da string traduzida (não entra em
 * `feed.trendingTitle`) porque não precisa de tradução — só o texto
 * ao lado muda por idioma.
 */
const DISPLAY_LIMIT = 3;

export function FeedTrendingModule({ items }: { items: TrendingItem[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const visible = items.slice(0, DISPLAY_LIMIT);

  if (visible.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.titleEmoji}>🔥</Text>
        <Text style={styles.title}>{t("feed.trendingTitle")}</Text>
      </View>
      <View style={styles.row}>
        {visible.map((item) => {
          const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w185") : null;
          return (
            <Pressable
              key={`${item.mediaType}-${item.mediaId}`}
              style={styles.item}
              onPress={() => router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`)}
            >
              <View style={styles.poster}>
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
                ) : (
                  <Feather name="film" size={18} color={colors.muted} />
                )}
              </View>
              <Text numberOfLines={1} style={styles.mediaTitle}>
                {item.mediaTitle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  titleEmoji: {
    fontSize: fontSize.sm,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  mediaTitle: {
    marginTop: 2,
    fontSize: fontSize.xxs,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
});
