import { View, Image, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/** TASK-116 — porta de MediaListRow.tsx. Usado pelo modo lista de Séries/Filmes/Favoritos dentro do Perfil. */
export function MediaListRow({ item, secondaryText, onPress }: { item: LibraryItem; secondaryText: string; onPress?: (item: LibraryItem) => void }) {
  const posterUrl = tmdbImageUrl(item.posterPath, "w185");

  return (
    <Pressable style={styles.row} onPress={() => onPress?.(item)}>
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
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
