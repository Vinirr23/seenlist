import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MovieWatchStatus } from "@seenlist/types";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import { RecommendSheet } from "../social/RecommendSheet";

const OPTIONS: { status: MovieWatchStatus; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { status: "watched", label: "Assistido", icon: "check" },
  { status: "want_to_watch", label: "Assistir depois", icon: "plus" },
];

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
  const [showRecommend, setShowRecommend] = useState(false);

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

      {/* TASK-169 — botão dedicado, não um menu "..." (filme nunca teve um, diferente de série) — menor mudança pra encaixar a funcionalidade. */}
      <Pressable style={styles.recommendButton} onPress={() => setShowRecommend(true)}>
        <Feather name="send" size={16} color={colors.muted} />
      </Pressable>

      {showRecommend && (
        <RecommendSheet
          mediaType="movie"
          mediaId={movieId}
          mediaTitle={movieTitle}
          onClose={() => setShowRecommend(false)}
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
  recommendButton: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
