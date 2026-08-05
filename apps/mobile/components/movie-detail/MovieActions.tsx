import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MovieWatchStatus } from "@seenlist/types";
import { useIsMovieFavorite } from "@/lib/useMovieDetails";
import { incrementMovieRewatch } from "@/lib/movieDetails";
import { hapticTick } from "@/lib/haptics";
import { OptionSheet } from "@/components/settings/OptionSheet";
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
 *
 * CORREÇÃO (a pedido — auditoria mais rigorosa, achado real: só
 * existia no web) — porta de TASK-047: tocar em "Assistido" quando
 * JÁ está assistido não desmarca direto — abre "Marcar como..."
 * ("Não assistido" / "Reassistido"), igual TV Time. Antes, tocar de
 * novo desmarcava na hora, sem perguntar nada.
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
  const [showWatchedActions, setShowWatchedActions] = useState(false);

  function handlePress(option: (typeof OPTIONS)[number]) {
    if (option.status === "watched" && currentStatus === "watched") {
      hapticTick();
      setShowWatchedActions(true);
      return;
    }
    onChange(option.status);
  }

  return (
    <View>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const active = currentStatus === option.status;
          return (
            <Pressable
              key={option.status}
              disabled={busy}
              onPress={() => handlePress(option)}
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

      {showWatchedActions && (
        <OptionSheet
          title="Marcar como..."
          onDismiss={() => setShowWatchedActions(false)}
          actions={[
            {
              label: "Não assistido",
              onPress: () => {
                hapticTick();
                onChange("watched");
                setShowWatchedActions(false);
              },
            },
            {
              label: "Reassistido",
              onPress: async () => {
                hapticTick();
                setShowWatchedActions(false);
                try {
                  await incrementMovieRewatch(movieId);
                } catch (error) {
                  console.error("[MovieActions] Falha ao registrar reassistido", error);
                }
              },
            },
          ]}
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
