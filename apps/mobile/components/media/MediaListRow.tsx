import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/** TASK-116 — porta de MediaListRow.tsx. Usado pelo modo lista de Séries/Filmes/Favoritos dentro do Perfil. */
export function MediaListRow({ item, secondaryText, onPress }: { item: LibraryItem; secondaryText: string; onPress?: (item: LibraryItem) => void }) {
  const posterUrl = tmdbImageUrl(item.posterPath, "w185");

  return (
    <Pressable onPress={() => onPress?.(item)}>
      <Glass style={styles.row} variant="card">
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        ) : (
          <Feather name="film" size={18} color={colors.muted} />
        )}
      </View>
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {item.title}
        </Text>
        {!!secondaryText && (
          <Text numberOfLines={1} variant="muted" style={styles.secondary}>
            {secondaryText}
          </Text>
        )}
      </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * PORTE DO WEB (2026-09-09, "implementar em todas as telas") — era um
   * cartão SÓLIDO (`colors.surface` + `colors.border`). O
   * `MediaListRow.tsx` do web usa vidro: `backdrop-blur-[18px]` com
   * `radial-gradient(... rgba(255,255,255,0.17) ...), rgba(255,255,255,0.10)`
   * — exatamente a receita `card` do `Glass` (`glassVariants`, em
   * `lib/theme.ts`). `borderWidth`/`borderColor`/`backgroundColor`
   * saíram daqui porque quem passa a desenhá-los é o `Glass`; o que fica
   * é só layout: direção, respiro, raio e padding.
   */
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  posterWrapper: {
    width: 56,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  secondary: {
    fontSize: 12,
    marginTop: 2,
  },
});
