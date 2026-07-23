import { useCallback, useState } from "react";
import { View, Image, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchReceivedRecommendations, type ReceivedRecommendation } from "@/lib/recommendations";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const AVATAR_SIZE = 32;

/**
 * Porta de `ProfileRecommendationsPreview.tsx` do web (já incluindo
 * os ajustes feitos lá: frase completa em até 2 linhas em vez de
 * truncar, selo de não-lida sobre os avatares em vez de linha de
 * texto própria, e contorno/fundo de destaque no card quando tem
 * recomendação não lida). Busca de novo toda vez que a aba Perfil
 * ganha foco, mesmo padrão que já existia aqui pra contagem de
 * não-lidas.
 */
export function ProfileRecommendationsPreview() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<ReceivedRecommendation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchReceivedRecommendations()
        .then((data) => {
          if (!cancelled) setRecommendations(data);
        })
        .catch((error) => {
          console.error("[ProfileRecommendationsPreview] Falha ao buscar recomendações", error);
          if (!cancelled) setRecommendations([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  if (isLoading && recommendations === null) {
    return <View style={[styles.card, { height: 80 }]} />;
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Pressable style={styles.card} onPress={() => router.push("/profile/recommendations")}>
        <View style={styles.emptyIcon}>
          <Feather name="send" size={16} color={colors.primary} />
        </View>
        <Text style={styles.title}>Recomendações</Text>
        <Text variant="muted" style={styles.emptyLabel}>
          Nenhuma ainda
        </Text>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </Pressable>
    );
  }

  const latest = recommendations[0]!;
  const uniqueSenderIds = [...new Set(recommendations.map((r) => r.sender.userId))];
  const uniqueSenders = [...new Map(recommendations.map((r) => [r.sender.userId, r.sender])).values()].slice(0, 4);
  const posterUrl = tmdbImageUrl(latest.posterPath, "w185");
  const unreadCount = recommendations.filter((r) => !r.readAt).length;
  const extraCount = recommendations.length - 1;
  const senderName = latest.sender.displayName ?? latest.sender.username;

  let message: string;
  if (extraCount === 0) {
    message = `${senderName} recomendou "${latest.title}" pra você`;
  } else if (uniqueSenderIds.length === 1) {
    message = `${senderName} recomendou "${latest.title}" e mais ${extraCount} ${extraCount === 1 ? "título" : "títulos"}`;
  } else {
    const others = uniqueSenderIds.length - 1;
    message = `${senderName} e mais ${others} ${others === 1 ? "pessoa" : "pessoas"} te recomendaram títulos`;
  }

  return (
    <Pressable
      style={[styles.card, unreadCount > 0 && styles.cardHighlighted]}
      onPress={() => router.push("/profile/recommendations")}
    >
      <View style={styles.avatarStack}>
        <View style={styles.avatarRow}>
          {uniqueSenders.map((sender, index) => (
            <View
              key={sender.userId}
              style={[styles.avatar, { marginLeft: index === 0 ? 0 : -10, zIndex: uniqueSenders.length - index }]}
            >
              {sender.avatarUrl ? (
                <Image source={{ uri: sender.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{(sender.displayName ?? sender.username).slice(0, 1).toUpperCase()}</Text>
              )}
            </View>
          ))}
        </View>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </View>

      <Text numberOfLines={2} style={styles.message}>
        {message}
      </Text>

      {posterUrl && (
        <View style={styles.poster}>
          <Image source={{ uri: posterUrl }} style={styles.posterImage} resizeMode="cover" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  /** Contorno/fundo de destaque quando tem recomendação não lida — mesmo ajuste feito no web. */
  cardHighlighted: {
    borderColor: "rgba(232,163,61,0.6)",
    backgroundColor: "rgba(232,163,61,0.05)",
  },
  emptyIcon: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(232,163,61,0.12)",
  },
  title: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  emptyLabel: {
    fontSize: fontSize.sm,
  },
  avatarStack: {
    position: "relative",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
  },
  unreadBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.background,
    lineHeight: 11,
  },
  message: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  poster: {
    width: 40,
    height: 56,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
});
