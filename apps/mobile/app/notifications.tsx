import { useCallback, useMemo, useState } from "react";
import { View, Pressable, FlatList, StyleSheet, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markInviteResponded,
  type AppNotification,
} from "@/lib/notifications";
import { acceptCoOwnerInvite, declineCoOwnerInvite } from "@/lib/lists";
import { tmdbImageUrl } from "@/lib/library";
import { Screen, Text, Skeleton, GlassTargetProvider, AmbientGlow, Glass, ScreenHeader } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, tint, fontSize } from "@/lib/theme";
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
    case "post_like":
      return t("notifications.postLike", { name });
    case "new_feedback":
      return t("notifications.newFeedback", { message: n.message ?? "" });
    case "verified_badge":
      return t("notifications.verifiedBadge");
    case "verified_badge_granted":
      return t("notifications.verifiedBadgeGranted");
    // LISTA COMPARTILHADA (2026-10-06) — ver
    // `claude/SEENLIST-FEATURE-2026-10-06-lista-compartilhada.md`.
    case "list_coowner_invite":
      return t("notifications.listCoownerInvite", { name, listName: n.listName ?? "" });
    case "list_coowner_accepted":
      return t("notifications.listCoownerAccepted", { name, listName: n.listName ?? "" });
    case "list_coowner_declined":
      return t("notifications.listCoownerDeclined", { name, listName: n.listName ?? "" });
    case "list_coowner_removed":
      return t("notifications.listCoownerRemoved", { name, listName: n.listName ?? "" });
    case "list_coowner_left":
      return t("notifications.listCoownerLeft", { name, listName: n.listName ?? "" });
  }
}

/**
 * A PEDIDO (2026-09-29 — "não aparece o selo na lista do sininho") —
 * porte fiel de `splitMessageAroundName` do web (`NotificationsView.tsx`,
 * mesmo comentário completo lá): o nome do ator fica embutido no MEIO
 * da frase traduzida, então acha o texto do nome já pronto dentro da
 * frase, em vez de reimplementar a interpolação. `<Text>` do React
 * Native aceita `<Image>` (o que `VerifiedBadge` renderiza) como filho
 * inline — documentado, funciona igual a texto+ícone dentro da mesma
 * linha.
 */
function splitMessageAroundName(message: string, name: string): { before: string; after: string } | null {
  if (!name) return null;
  const index = message.indexOf(name);
  if (index === -1) return null;
  return { before: message.slice(0, index), after: message.slice(index + name.length) };
}

/**
 * CORREÇÃO (bug real, reportado — "curti um post mas não recebi
 * notificação", 2026-09-29) — causa raiz era `notify_like()` no
 * banco, que só tratava `target_type` comment/review (ver migration
 * `20260929000002_post_like_notifications.sql`). `post_like` linka
 * direto pro post (`targetId`), antes do fallback de mídia.
 */
function getNotificationRoute(n: AppNotification): string | null {
  if (n.type === "new_follower") {
    return n.actor?.username ? `/u/${n.actor.username}` : null;
  }
  if (n.type === "feedback_reply") {
    return "/settings/feedback";
  }
  if (n.type === "post_like") {
    return n.targetId ? `/posts/${n.targetId}` : null;
  }
  if (n.type === "verified_badge" || n.type === "verified_badge_granted") {
    return "/profile";
  }
  if (n.targetType === "list" && n.targetId) {
    return `/lists/${n.targetId}`;
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
  // A PEDIDO (2026-09-29 — notificação de lançamento do selo, "sino
  // padrão" pra quem não tem selo) — ícone dessa notificação é o
  // PRÓPRIO selo de quem está lendo (sem ator/mídia pra mostrar).
  const { user: currentUser } = useCurrentUser();
  // LISTA COMPARTILHADA (2026-10-06) — responder ao convite sem
  // precisar abrir a lista; linha isolada (id -> carregando) pra não
  // travar as outras notificações enquanto uma está em voo.
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    fetchNotifications(locale).then(setNotifications);
  }, [locale]);

  useFocusEffect(reload);

  function handleOpen(n: AppNotification) {
    if (!n.readAt) markNotificationRead(n.id).then(reload);
    const route = getNotificationRoute(n);
    if (route) router.push(route as never);
  }

  async function handleRespondInvite(n: AppNotification, accept: boolean) {
    if (!n.targetId || !n.actor) return;
    setRespondingId(n.id);
    try {
      if (accept) {
        await acceptCoOwnerInvite(n.targetId, n.listName ?? "", n.actor.userId);
      } else {
        await declineCoOwnerInvite(n.targetId, n.listName ?? "", n.actor.userId);
      }
      /*
       * CORREÇÃO DE CAUSA RAIZ (2026-10-07) — a ação que importa
       * (aceitar/recusar na lista, acima) JÁ aconteceu nesse ponto. O
       * que vem a seguir é só cosmético: marcar a notificação como
       * respondida (pra trocar os botões por uma confirmação, ver
       * `responded` em `lib/notifications.ts`) e como lida. Antes,
       * essas duas chamadas estavam no MESMO `try` da ação principal —
       * uma falha aqui (ex.: rede instável bem na hora, "Tente de novo
       * em instantes" no primeiro print) fazia aparecer o alerta de
       * erro genérico MESMO com o convite já respondido de verdade no
       * banco, e como o card nunca mudava de estado, o usuário tocava
       * "Aceitar" de novo — essa segunda tentativa aí sim falhava de
       * verdade (o trigger `lists_restrict_co_owner_update` rejeita
       * aceitar um convite que já não está mais "pending", de
       * propósito). Separado num `try` próprio pra uma falha cosmética
       * nunca mais parecer que a resposta ao convite falhou.
       */
      try {
        await markInviteResponded(n.id, n.listName, accept ? "accepted" : "declined");
        if (!n.readAt) await markNotificationRead(n.id);
      } catch (cosmeticError) {
        console.error("[NotificationsScreen] Convite respondido com sucesso, mas falhou ao atualizar o card", cosmeticError);
      }
      reload();
    } catch (error) {
      console.error("[NotificationsScreen] Falha ao responder convite de co-dono", error);
      Alert.alert(t("error.generic"), t("error.respondInviteFailed"));
    } finally {
      setRespondingId(null);
    }
  }

  function handleMarkAllRead() {
    markAllNotificationsRead().then(reload);
  }

  const hasUnread = (notifications ?? []).some((n) => !n.readAt);

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={t("profile.notifications")}
        right={
          hasUnread ? (
            <Pressable onPress={handleMarkAllRead} hitSlop={8}>
              <Text style={styles.markAllText}>{t("notifications.markAllRead")}</Text>
            </Pressable>
          ) : undefined
        }
      />

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
                <Skeleton width={36} height={36} borderRadius={18} />
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
              const actorName = n.actor?.displayName ?? (n.actor ? `@${n.actor.username}` : "");
              const split = n.actor?.verifiedTier ? splitMessageAroundName(message, actorName) : null;
              return (
                <Pressable onPress={() => handleOpen(n)}>
                  <Glass style={[styles.card, !n.readAt && styles.cardUnread]}>
                    <View style={styles.avatarWrapper}>
                      {n.actor ? (
                        <Avatar uri={n.actor.avatarUrl} name={n.actor.displayName ?? n.actor.username} style={styles.avatar} textStyle={styles.avatarInitials} />
                      ) : n.mediaPosterPath ? (
                        <Image source={{ uri: tmdbImageUrl(n.mediaPosterPath, "w185") ?? undefined }} style={styles.avatar} />
                      ) : (n.type === "verified_badge" || n.type === "verified_badge_granted") && currentUser?.verifiedTier ? (
                        /*
                          A PEDIDO (2026-09-29 — "sino padrão" pra quem
                          não tem selo) — quem TEM selo vê o próprio
                          selo aqui em vez do sininho; quem não tem cai
                          no fallback de sempre logo abaixo.
                        */
                        <View style={[styles.avatar, styles.iconFallback]}>
                          <VerifiedBadge tier={currentUser.verifiedTier} size={20} />
                        </View>
                      ) : (
                        <View style={[styles.avatar, styles.iconFallback]}>
                          <Feather name="bell" size={16} color={colors.primary} />
                        </View>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.message}>
                        {split ? (
                          <>
                            {split.before}
                            {actorName}
                            <VerifiedBadge tier={n.actor!.verifiedTier} size={13} />
                            {split.after}
                          </>
                        ) : (
                          message
                        )}
                      </Text>
                      <Text variant="muted" style={styles.date}>
                        {dateFormatter.format(new Date(n.createdAt))}
                      </Text>
                      {/*
                        LISTA COMPARTILHADA (2026-10-06) — convite com
                        resposta inline, sem precisar abrir a lista pra
                        decidir. `respondingId` desabilita só ESTA
                        linha enquanto a resposta está em voo.
                      */}
                      {n.type === "list_coowner_invite" &&
                        (n.responded ? (
                          <Text style={styles.inviteRespondedText}>
                            {n.responded === "accepted"
                              ? t("notifications.listCoownerInviteAccepted", { listName: n.listName ?? "" })
                              : t("notifications.listCoownerInviteDeclined", { listName: n.listName ?? "" })}
                          </Text>
                        ) : (
                          <View style={styles.inviteActions}>
                            <Pressable
                              style={[styles.inviteButton, styles.inviteButtonDecline]}
                              disabled={respondingId === n.id}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleRespondInvite(n, false);
                              }}
                            >
                              <Text style={styles.inviteButtonDeclineText}>{t("common.decline")}</Text>
                            </Pressable>
                            <Pressable
                              style={[styles.inviteButton, styles.inviteButtonAccept]}
                              disabled={respondingId === n.id}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleRespondInvite(n, true);
                              }}
                            >
                              <Text style={styles.inviteButtonAcceptText}>{t("common.accept")}</Text>
                            </Pressable>
                          </View>
                        ))}
                    </View>
                    {!n.readAt && <View style={styles.unreadDot} />}
                  </Glass>
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
  markAllText: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.primary,
  },
  content: {
    padding: spacing.md,
  },
  /*
   * CORREÇÃO (a pedido, 2026-09-15 — "a tela de notificações não tem
   * o design glass também"). Causa raiz: o campo de manchas
   * (`GlassTargetProvider`/`AmbientGlow`, acima) já estava correto —
   * mas o CARD em si continuava um `View`/`Pressable` com
   * `backgroundColor: colors.surface` CHAPADO (opaco), o padrão
   * antigo de antes do vidro existir. Numa lista densa (vários cards,
   * só 8px de vão entre eles), isso cobre quase toda a mancha atrás —
   * pouquíssimo vidro visível de verdade, mesmo com o fundo certo.
   *
   * Web (`NotificationsView.tsx`): cada linha é
   * `backdrop-blur-[18px] backdrop-saturate-[180%]` — o mesmo card de
   * vidro de `MyCommentRow.tsx`/`comments.tsx`. Porte fiel: `Glass`
   * (variant "card", padrão) em vez de `View`+cor sólida.
   */
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  /*
   * Não lida: mesmo par âmbar (`tint.border`/`tint.subtle`) já usado
   * pra destaque de item ativo no resto do app — equivalente ao
   * `rgba(240,169,79, ...)` que o web usa nesta MESMA tela pra
   * notificação não lida. `Glass` aceita `borderColor`/`backgroundColor`
   * no `style` como override explícito da receita padrão (ver
   * `Glass.tsx`, "fundoDoChamador"/"bordaDoChamador") — continua
   * sendo vidro de verdade (blur+saturação), só com o véu colorido.
   */
  cardUnread: {
    borderColor: tint.border,
    backgroundColor: tint.subtle,
  },
  /**
   * FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do
   * usuário: "Unificar em 36px") — era 44/22, o único lugar do app
   * (junto de `FollowListRow.tsx`) com esse avatar de linha num
   * tamanho diferente do resto ("Opção B" da Fase 1: 36px, já usado em
   * comentários/posts/atividade/recomendações).
   */
  avatarWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: "hidden",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarInitials: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.sm` (era literal 14, mesmo valor).
    fontSize: fontSize.sm,
  },
  iconFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — tokens formalizados `fontSize.sm`/`fontSize.xxs` (eram literais 14/11, mesmos valores).
  message: { fontSize: fontSize.sm, color: colors.text, lineHeight: 19 },
  date: { fontSize: fontSize.xxs, marginTop: 2 },
  inviteActions: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  inviteButton: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  inviteButtonAccept: { backgroundColor: colors.primary },
  inviteButtonAcceptText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.background },
  inviteButtonDecline: { borderWidth: 1, borderColor: colors.border },
  inviteButtonDeclineText: { fontSize: fontSize.xs, fontWeight: "700", color: colors.muted },
  inviteRespondedText: { fontSize: fontSize.xs, color: colors.muted, marginTop: spacing.xs, fontStyle: "italic" },
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
