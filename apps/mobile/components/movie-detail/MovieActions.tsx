import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MovieWatchStatus } from "@seenlist/types";
import { useIsMovieFavorite } from "@/lib/useMovieDetails";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

const OPTIONS: { status: MovieWatchStatus; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { status: "watched", label: "Assistido", icon: "check" },
  { status: "want_to_watch", label: "Assistir depois", icon: "plus" },
];

/**
 * TASK-172 (ajuste 2 — a pedido, "tudo apertado") — o "..." saiu
 * daqui de vez e foi pro canto superior direito da capa
 * (`MovieHeader.tsx`, prop `onMorePress`), mesmo lugar exato de
 * `SeriesHeader.tsx` — agora fica só: Assistido, Assistir depois,
 * coração de favorito.
 */
export function MovieActions({
  movieId,
  currentStatus,
  busy,
  onChange,
}: {
  movieId: number;
  currentStatus: MovieWatchStatus | null;
  busy: boolean;
  onChange: (status: MovieWatchStatus) => void;
}) {
  const { isFavorite, busy: favoriteBusy, toggle: toggleFavorite } = useIsMovieFavorite(movieId);

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const active = currentStatus === option.status;
        return (
          <Pressable
            key={option.status}
            disabled={busy}
            onPress={() => onChange(option.status)}
            style={[styles.button, active && styles.buttonActive]}
          >
            <Feather name={option.icon} size={16} color={active ? colors.primary : colors.muted} />
            <Text variant="label" style={active ? styles.labelActive : styles.label}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}

      <Pressable style={styles.iconButton} disabled={favoriteBusy} onPress={toggleFavorite}>
        <Feather name="heart" size={16} color={isFavorite ? colors.danger : colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(232,163,61,0.12)",
  },
  label: {
    color: colors.muted,
    fontSize: 11,
  },
  labelActive: {
    color: colors.primary,
    fontSize: 11,
  },
  iconButton: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
