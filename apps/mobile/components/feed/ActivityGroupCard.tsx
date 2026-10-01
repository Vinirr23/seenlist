import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { ActivityGroup } from "@/lib/useFeedEntries";
import type { ActivityItem } from "@/lib/activityFeed";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useNow } from "@/lib/useNow";
import { formatRelativeTime } from "@/lib/relativeTime";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const POSTER_DISPLAY_LIMIT = 3;

/**
 * ACTIVITY GROUP CARD (2026-10-01, reportado — print mostrando a
 * mesma pessoa ("Camila") dominando o Feed inteiro em poucos minutos:
 * 5 atividades automáticas seguidas). Agrupamento de verdade acontece
 * em `lib/useFeedEntries.ts` (`groupConsecutiveActivity` — mesmo
 * usuário, até 15 min de diferença entre ações consecutivas); este
 * componente só decide COMO mostrar um grupo já pronto.
 *
 * DOIS LAYOUTS, igual ao pedido:
 *   - Mesmo tipo de ação em todos os itens do grupo → frase
 *     específica ("terminou N títulos"/"adicionou N à lista"/"avaliou
 *     N títulos") + ícone do tipo, igual ao verbo dos cards normais.
 *   - Tipos diferentes misturados (ex.: 3 "completed" + 2
 *     "watchlist", igual ao print original) → resumo compacto
 *     ("teve bastante atividade") com uma pílula por tipo presente
 *     ("✓ 3 concluídos", "🔖 2 adicionados", "★ 1 avaliado").
 *
 * Em ambos: até `POSTER_DISPLAY_LIMIT` pôsteres lado a lado (toque em
 * cada um leva pro detalhe daquele título específico), com "+N" se
 * houver mais itens no grupo do que cabe.
 *
 * SEM botão de watchlist aqui (decisão não confirmada com o usuário,
 * só a mais razoável dentre as não especificadas — um grupo tem N
 * títulos diferentes, um botão só por card não faria sentido sem
 * virar N botões pequenos, o que voltaria a ser ruído visual. Avisar
 * se quiser outra solução.) — pra adicionar à lista um título
 * específico do grupo, abre o próprio título (toque no pôster).
 *
 * SEM Hero aqui de propósito — um item dentro de um grupo NUNCA passa
 * pelo throttle de Hero (`lib/useFeedEntries.ts`, `applyHeroThrottle`
 * só examina `kind: "activity"`, nunca `"activityGroup"`): pedido
 * explícito — "não usaria Hero card quando isso acontecer... Hero
 * deveria aparecer quando uma atividade ISOLADA merece destaque".
 */
export function ActivityGroupCard({ group }: { group: ActivityGroup }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const now = useNow(30_000);
  const head = group.items[0];

  const types = new Set(group.items.map((i) => i.activityType));
  const allSameType = types.size === 1;
  const visiblePosters = group.items.slice(0, POSTER_DISPLAY_LIMIT);
  const extraCount = group.items.length - visiblePosters.length;

  function handlePressUser(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    router.push(`/u/${head.userUsername}`);
  }

  function handlePressItem(item: ActivityItem) {
    router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`);
  }

  const counts = {
    completed: group.items.filter((i) => i.activityType === "completed").length,
    watchlist: group.items.filter((i) => i.activityType === "watchlist").length,
    rated: group.items.filter((i) => i.activityType === "rated").length,
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Pressable style={styles.header} onPress={handlePressUser}>
          <Avatar uri={head.userAvatarUrl} name={head.userName} style={styles.avatar} textStyle={styles.avatarInitials} />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.authorName}>
                {head.userName}
              </Text>
              <VerifiedBadge tier={head.userVerifiedTier} size={fontSize.sm} />
              <Text numberOfLines={1} variant="muted" style={styles.meta}>
                {formatRelativeTime(head.createdAt, now, locale, t("feed.justNow"))}
              </Text>
            </View>
            {allSameType ? (
              <View style={styles.verbRow}>
                {head.activityType === "watchlist" ? (
                  <Feather name="bookmark" size={11} color={colors.primary} />
                ) : head.activityType === "completed" ? (
                  <Feather name="check-circle" size={11} color={colors.success} />
                ) : (
                  <Feather name="star" size={11} color={colors.primary} />
                )}
                <Text variant="muted" style={styles.verb}>
                  {t(
                    head.activityType === "watchlist"
                      ? "feed.activityGroupWatchlist"
                      : head.activityType === "completed"
                        ? "feed.activityGroupCompleted"
                        : "feed.activityGroupRated",
                    { count: group.items.length }
                  )}
                </Text>
              </View>
            ) : (
              <Text variant="muted" style={styles.verb}>
                {t("feed.activityGroupMixedVerb", { count: group.items.length })}
              </Text>
            )}
          </View>
        </Pressable>
      </View>

      {!allSameType && (
        <View style={styles.pillsRow}>
          {counts.completed > 0 && (
            <View style={styles.pill}>
              <Feather name="check-circle" size={11} color={colors.success} />
              <Text style={styles.pillText}>{t("feed.activityGroupMixedCompleted", { count: counts.completed })}</Text>
            </View>
          )}
          {counts.watchlist > 0 && (
            <View style={styles.pill}>
              <Feather name="bookmark" size={11} color={colors.primary} />
              <Text style={styles.pillText}>{t("feed.activityGroupMixedWatchlist", { count: counts.watchlist })}</Text>
            </View>
          )}
          {counts.rated > 0 && (
            <View style={styles.pill}>
              <Feather name="star" size={11} color={colors.primary} />
              <Text style={styles.pillText}>{t("feed.activityGroupMixedRated", { count: counts.rated })}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.postersRow}>
        {visiblePosters.map((item) => {
          const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w185") : null;
          return (
            <Pressable key={item.id} style={styles.posterWrap} onPress={() => handlePressItem(item)}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
              ) : (
                <Feather name="film" size={16} color={colors.muted} />
              )}
            </Pressable>
          );
        })}
        {extraCount > 0 && (
          <View style={styles.morePill}>
            <Text style={styles.morePillText}>+{extraCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  header: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarInitials: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  authorName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  meta: {
    flexShrink: 0,
    fontSize: fontSize.xxs,
  },
  verbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  verb: {
    fontSize: fontSize.xs,
  },
  // `marginBottom` novo (2026-10-01, feedback de design — "daria um
  // pouco mais de espaço entre os chips e os posters... hoje quase
  // encosta nas capas") — +4px de respiro antes de `postersRow`.
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: 4,
  },
  // Contraste aumentado (2026-10-01, feedback de design — "'2
  // finished' e '1 rated' estão pequenos demais e com baixo
  // contraste. Eles precisam continuar secundários, mas legíveis") —
  // era `fontSize.micro`/`colors.muted`; subiu um degrau em tamanho e
  // cor, sem virar destaque (continuam menores/mais discretas que o
  // texto principal do card).
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  pillText: {
    fontSize: fontSize.xxs,
    fontWeight: "600",
    color: colors.text,
  },
  postersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  // Aumentado DUAS vezes (2026-10-01, feedback de design) — era 44×64
  // (tier compacto puro); 1ª rodada subiu pra 56×82; 2ª rodada
  // (comentário atual) — "aumentaria os posters do agrupamento uns
  // 8-12%... são a informação principal e ainda há espaço horizontal"
  // — 62×90 (~+11% sobre 56×82).
  posterWrap: {
    width: 62,
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  morePill: {
    width: 62,
    height: 90,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  morePillText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
});
