import { useCallback, useMemo, useState } from "react";
import { View, Pressable, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "@/lib/notifications";
import { tmdbImageUrl } from "@/lib/library";
import { Screen, Text, Skeleton, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, tint } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * A PEDIDO (2026-09-15 — sino de notificações no Perfil, web +
 * mobile). Porte fiel de `NotificationsView.tsx` do web — mesmo
 * formato de card de `app/profile/recommendations.tsx` (não lida
 * ganha borda/fundo âmbar). Ver a migration nova
 * (`20260915010000_notification_triggers_missing_types.sql`) pra
 * causa raiz de por que só 3 dos 7 tipos previstos realmente geravam
 * notificação até agora.
 */
function getNotificationMessage(n: AppNotification, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const name = n.actor?.displayName ?? (n.actor ? `@${n.actor.username}` : "");
  const title = n.mediaTitle ?? "";
  switch (n.type) {
    case "comment_reply":
      return t("notifications.commentReply", { name, title });
    case "comment_like":
      return t("notifications.commentLike", { name, title });
    case "review_like":
      return t("notifications.reviewLike", { name, title });
    case "episode_new":
      return t("notifications.episodeNew", { title });
    case "season_premiere":
      return t("notifications.seasonPremiere", { title });
    case "recommendation":
      return t("notifications.recommendation", { name, title });
    case "new_follower":
      return t("notifications.newFollower", { name });
    case "feedback_reply":
      return t("notifications.feedbackReply");
  }
}

function getNotificationRoute(n: AppNotification): string | null {
  if (n.type === "new_follower") {
    return n.actor?.username ? `/u/${n.actor.username}` : null;
  }
  if (n.type === "feedback_reply") {
    return "/settings/feedback";
  }
  if (n.mediaType && n.mediaId != null) {
    return n.mediaType === "movie" ? `/movies/${n.mediaId}` : `/series/${n.mediaId}`;
  }
  return null;
}

export default function NotificationsScreen() {
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" }), [locale]);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);

  const reload = useCallback(() => {
    fetchNotifications(locale).then(setNotifications);
  }, [locale]);

  useFocusEffect(reload);

  function handleOpen(n: AppNotification) {
    if (!n.readAt) markNotificationRead(n.id).then(reload);
    const route = getNotificationRoute(n);
    if (route) router.push(route as never);
  }

  function handleMarkAllRead() {
    markAllNotificationsRead().then(reload);
  }

  const hasUnread = (notifications ?? []).some((n) => !n.readAt);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle" style={styles.headerTitle}>
          {t("profile.notifications")}
        </Text>
        {hasUnread && (
          <Pressable onPress={handleMarkAllRead} hitSlop={8}>
            <Text style={styles.markAllText}>{t("notifications.markAllRead")}</Text>
          </Pressable>
        )}
      </View>

      {/*
        * CORREÇÃO (a pedido, 2026-09-15/16 — "as cores de fundo devem
        * ser as mesmas do restante do app, que é azul") — esta tela
        * nem tinha `GlassTargetProvider`/`AmbientGlow` nenhum (fundo
        * chapado, sem o campo de manchas que toda outra tela do app
        * tem). Mesmo `SUBPAGE_GLOW_BLOBS` de Comentários/Minhas
        * listas — é o mesmo formato de sub-tela "voltar + título".
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        {notifications === null ? (
          <View style={[styles.content, { gap: spacing.sm }]}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.card}>
                <Skeleton width={44} height={44} borderRadius={22} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Skeleton width="80%" height={13} />
                  <Skeleton width="40%" height={11} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(n) => n.id}
            contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
            ListEmptyComponent={<EmptyState message={t("notifications.empty")} />}
            renderItem={({ item: n }) => {
              const message = getNotificationMessage(n, t);
              return (
                <Pressable style={[styles.card, !n.readAt && styles.cardUnread]} onPress={() => handleOpen(n)}>
                  <View style={styles.avatarWrapper}>
                    {n.actor ? (
                      <Avatar uri={n.actor.avatarUrl} name={n.actor.displayName ?? n.actor.username} style={styles.avatar} textStyle={styles.avatarInitials} />
                    ) : n.mediaPosterPath ? (
                      <Image source={{ uri: tmdbImageUrl(n.mediaPosterPath, "w185") ?? undefined }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.iconFallback]}>
                        <Feather name="bell" size={16} color={colors.primary} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.message}>{message}</Text>
                    <Text variant="muted" style={styles.date}>
                      {dateFormatter.format(new Date(n.createdAt))}
                    </Text>
                  </View>
                  {!n.readAt && <View style={styles.unreadDot} />}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </GlassTargetProvider>
    </Screen>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text variant="muted" style={styles.emptyStateText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    flex: 1,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  content: {
    padding: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  cardUnread: {
    borderColor: tint.border,
    backgroundColor: tint.subtle,
  },
  avatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitials: {
    fontSize: 14,
  },
  iconFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  message: { fontSize: 14, color: colors.text, lineHeight: 19 },
  date: { fontSize: 11, marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  /** Web (`EmptyState.tsx`): `flex flex-col items-center justify-center gap-1 py-16 text-center` — py-16=64, gap-1=4. */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 64,
  },
  emptyStateText: {
    textAlign: "center",
  },
});
