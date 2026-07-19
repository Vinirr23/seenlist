import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { MovieWatchStatus } from "@seenlist/types";
import { useIsMovieFavorite } from "@/lib/useMovieDetails";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import { MovieQuickActionsSheet } from "./MovieQuickActionsSheet";

const OPTIONS: { status: MovieWatchStatus; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { status: "watched", label: "Assistido", icon: "check" },
  { status: "want_to_watch", label: "Assistir depois", icon: "plus" },
];

/**
 * TASK-172 (ajuste — a pedido) — só 3 botões principais, igual
 * série: Assistido, Assistir depois, coração de favorito (achado
 * real: nunca existiu pra filme no mobile, só série — agora usa
 * `useIsMovieFavorite`, espelhando `useIsFavorite` de série). O
 * botão de recomendar isolado saiu daqui — foi pro menu "...", que
 * ganhou junto: adicionar a lista (também não existia pra filme),
 * remover, compartilhar.
 */
export function MovieActions({
  movieId,
  movieTitle,
  currentStatus,
  busy,
  onChange,
}: {
  movieId: number;
  movieTitle: string;
  currentStatus: MovieWatchStatus | null;
  busy: boolean;
  onChange: (status: MovieWatchStatus) => void;
}) {
  const router = useRouter();
  const { isFavorite, busy: favoriteBusy, toggle: toggleFavorite } = useIsMovieFavorite(movieId);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

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

      <Pressable style={styles.iconButton} onPress={() => setShowMoreOptions(true)}>
        <Feather name="more-vertical" size={16} color={colors.muted} />
      </Pressable>

      {showMoreOptions && (
        <MovieQuickActionsSheet
          movieId={movieId}
          movieTitle={movieTitle}
          onRemoved={() => router.back()}
          onClose={() => setShowMoreOptions(false)}
        />
      )}
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
