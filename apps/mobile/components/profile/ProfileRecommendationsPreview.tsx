import { useCallback, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchReceivedRecommendations, type ReceivedRecommendation } from "@/lib/recommendations";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Skeleton, Glass } from "@/components/ui";
import { colors, radius, spacing, fontSize, tint } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

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
  const { t, locale } = useTranslation();
  const [recommendations, setRecommendations] = useState<ReceivedRecommendation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchReceivedRecommendations(locale)
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
    }, [locale])
  );

  if (isLoading && recommendations === null) {
    /*
     * CORREÇÃO (auditoria — "loaders diferentes") — era uma caixa
     * cinza ESTÁTICA, sem animação, enquanto o resto do app usa o
     * `Skeleton` pulsante. Duas linguagens de carregamento no mesmo
     * Perfil, uma parecendo "conteúdo quebrado" e a outra
     * "carregando".
     */
    return <Skeleton width="100%" height={80} />;
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Pressable onPress={() => router.push("/profile/recommendations")}>
        <Glass style={styles.card}>
          <View style={styles.emptyIcon}>
            <Feather name="send" size={16} color={colors.primary} />
          </View>
          <Text numberOfLines={1} style={styles.title}>
            {t("profile.recommendationsTitle")}
          </Text>
          <Text variant="muted" style={styles.emptyLabel}>
            {t("profile.noRecommendationsShort")}
          </Text>
          <Feather name="chevron-right" size={16} color={colors.muted} />
        </Glass>
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
    message = t("profile.recommendedSingle", { sender: senderName, title: latest.title });
  } else if (uniqueSenderIds.length === 1) {
    message = t("profile.recommendedPlusTitles", {
      sender: senderName,
      title: latest.title,
      count: extraCount,
      noun: extraCount === 1 ? t("profile.titleSingular") : t("profile.titlePlural"),
    });
  } else {
    const others = uniqueSenderIds.length - 1;
    message = t("profile.recommendedByMultiplePeople", {
      sender: senderName,
      count: others,
      noun: others === 1 ? t("profile.personSingular") : t("profile.personPlural"),
    });
  }

  return (
    <Pressable onPress={() => router.push("/profile/recommendations")}>
      <Glass style={[styles.card, unreadCount > 0 && styles.cardHighlighted]}>
        <View style={styles.avatarStack}>
          <View style={styles.avatarRow}>
            {uniqueSenders.map((sender, index) => (
              <View
                key={sender.userId}
                /* CORREÇÃO (2026-09-03, comparado com o web) — era -10; o web usa `-space-x-3` (`ProfileRecommendationsPreview.tsx`, avatares sobrepostos) = -12px. */
                style={[styles.avatar, { marginLeft: index === 0 ? 0 : -12, zIndex: uniqueSenders.length - index }]}
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
            <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
          </View>
        )}
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.sm`
   * (8); o web usa `gap-3` (`ProfileRecommendationsPreview.tsx`,
   * card) = 12px — sem token exato, valor literal.
   * `paddingVertical: spacing.sm + 4` (12) também estava errado — o
   * web usa `py-3.5` = 14px.
   */
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `marginHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela. `marginBottom`
  // (ritmo vertical) NÃO foi tocado — fora do escopo.
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  /** Contorno de destaque quando tem recomendação não lida — mesmo ajuste feito no web. Só a borda (não o fundo, que já é o vidro) pra não brigar com o gradiente/blur do `Glass`. */
  cardHighlighted: {
    borderColor: tint.border,
  },
  emptyIcon: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tint.subtle,
  },
  title: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `fontSize.sm` (14); o web usa `text-xs` (`ProfileRecommendationsPreview.tsx`, "profile.noneYet") = 12px. */
  emptyLabel: {
    fontSize: fontSize.xs,
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
  /** CORREÇÃO (2026-09-03, comparado com o web) — `paddingHorizontal: 3`; o web usa `px-1` (`ProfileRecommendationsPreview.tsx`, selo de não lidas) = 4px. Resto (h-4/min-w-4/rounded-full/border-2 = 16/16/full/2) já batia. */
  unreadBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
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
