import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { radius, spacing } from "@/lib/theme";
import type { SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";

/** TASK-170 — porta de `SeriesCaughtUpCard.tsx` do web, mesmas cores (azul = "Em dia", verde = "Assistidas"). */
export function SeriesCaughtUpCard({ badge }: { badge: Exclude<SeriesCaughtUpBadge, null> }) {
  if (badge === "ongoing") {
    return (
      <View style={[styles.card, styles.cardOngoing]}>
        <Feather name="zap" size={18} color="#60a5fa" />
        <View style={styles.textWrapper}>
          <Text style={styles.title}>Você está em dia!</Text>
          <Text variant="muted" style={styles.subtitle}>
            Mais episódios a caminho.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.cardEnded]}>
      <Feather name="award" size={18} color="#4ade80" />
      <View style={styles.textWrapper}>
        <Text style={styles.title}>Série encerrada</Text>
        <Text variant="muted" style={styles.subtitle}>
          Você assistiu tudo — não vem mais episódio novo por aí.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  cardOngoing: {
    borderColor: "rgba(96,165,250,0.4)",
    backgroundColor: "rgba(96,165,250,0.1)",
  },
  cardEnded: {
    borderColor: "rgba(74,222,128,0.4)",
    backgroundColor: "rgba(74,222,128,0.1)",
  },
  textWrapper: { flex: 1 },
  title: { fontSize: 14, fontWeight: "600" },
  subtitle: { fontSize: 12, marginTop: 1 },
});
