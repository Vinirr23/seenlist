import { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Image, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  fetchReceivedRecommendations,
  markRecommendationRead,
  dismissRecommendation,
  blockUser,
  unblockUser,
  fetchBlockedUsers,
  type ReceivedRecommendation,
  type BlockedUser,
} from "@/lib/recommendations";
import { Screen, Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-169 — porta de `RecommendationsPageView.tsx` do web. Marca
 * como lida ao TOCAR no card (não ao só abrir a tela), mesmo
 * raciocínio do web. Bloquear mora aqui (não em Configurações) por
 * ser a ação mais provável de precisar bem na hora que uma
 * recomendação indesejada chega.
 */
export default function RecommendationsScreen() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<ReceivedRecommendation[] | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);

  const reload = useCallback(() => {
    fetchReceivedRecommendations().then(setRecommendations);
    fetchBlockedUsers().then(setBlockedUsers);
  }, []);

  useEffect(reload, [reload]);
  useFocusEffect(reload);

  function handleOpen(rec: ReceivedRecommendation) {
    if (!rec.readAt) {
      markRecommendationRead(rec.id).then(reload);
    }
    router.push(rec.mediaType === "movie" ? `/movies/${rec.mediaId}` : `/series/${rec.mediaId}`);
  }

  function handleDismiss(id: string) {
    dismissRecommendation(id).then(reload);
  }

  function handleBlock(rec: ReceivedRecommendation) {
    Alert.alert(
      `Bloquear @${rec.sender.username}?`,
      "Você não vai mais receber recomendações dessa pessoa.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Bloquear",
          style: "destructive",
          onPress: () => blockUser(rec.sender.userId).then(reload),
        },
      ]
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Recomendações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {recommendations === null && <Text variant="muted">Carregando...</Text>}

        {recommendations && recommendations.length === 0 && (
          <Text variant="muted">Ninguém te recomendou nada ainda.</Text>
        )}

        {recommendations?.map((rec) => (
          <View key={rec.id} style={[styles.card, !rec.readAt && styles.cardUnread]}>
            <Pressable style={styles.cardMain} onPress={() => handleOpen(rec)}>
              <View style={styles.poster}>
                {rec.posterPath && (
                  <Image source={{ uri: `https://image.tmdb.org/t/p/w185${rec.posterPath}` }} style={styles.posterImage} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="muted" style={styles.senderLine}>
                  <Text style={styles.senderName}>{rec.sender.displayName ?? `@${rec.sender.username}`}</Text> recomendou
                </Text>
                <Text numberOfLines={1} style={styles.mediaTitle}>
                  {rec.title}
                </Text>
                {!!rec.message && (
                  <Text numberOfLines={2} variant="muted" style={styles.message}>
                    &quot;{rec.message}&quot;
                  </Text>
                )}
                <Text variant="muted" style={styles.date}>
                  {dateFormatter.format(new Date(rec.createdAt))}
                </Text>
              </View>
            </Pressable>

            <View style={styles.cardActions}>
              <Pressable onPress={() => handleDismiss(rec.id)} hitSlop={8}>
                <Feather name="x" size={16} color={colors.muted} />
              </Pressable>
              <Pressable onPress={() => handleBlock(rec)} hitSlop={8}>
                <Feather name="slash" size={16} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        ))}

        {blockedUsers.length > 0 && (
          <View style={styles.blockedSection}>
            <Pressable style={styles.blockedToggle} onPress={() => setShowBlocked((v) => !v)}>
              <Text variant="muted" style={styles.blockedToggleText}>
                Usuários bloqueados ({blockedUsers.length})
              </Text>
              <Feather name={showBlocked ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
            </Pressable>

            {showBlocked &&
              blockedUsers.map((user) => (
                <View key={user.userId} style={styles.blockedRow}>
                  <Text style={styles.blockedName}>{user.displayName ?? `@${user.username}`}</Text>
                  <Pressable onPress={() => unblockUser(user.userId).then(reload)}>
                    <Text style={styles.unblockText}>Desbloquear</Text>
                  </Pressable>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  cardUnread: {
    borderColor: "rgba(232,163,61,0.4)",
    backgroundColor: "rgba(232,163,61,0.06)",
  },
  cardMain: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.sm,
  },
  poster: {
    width: 56,
    height: 80,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  posterImage: { width: "100%", height: "100%" },
  senderLine: { fontSize: 12 },
  senderName: { fontWeight: "700", color: colors.text },
  mediaTitle: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: 2 },
  message: { fontSize: 12, marginTop: 2 },
  date: { fontSize: 10, marginTop: spacing.xs },
  cardActions: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  blockedSection: { marginTop: spacing.lg },
  blockedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  blockedToggleText: { fontSize: 12, fontWeight: "500" },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  blockedName: { fontSize: 14, color: colors.text },
  unblockText: { fontSize: 12, fontWeight: "600", color: colors.primary },
});
