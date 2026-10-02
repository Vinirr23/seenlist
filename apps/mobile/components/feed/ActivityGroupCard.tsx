import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { ActivityGroup } from "@/lib/useFeedEntries";
import type { ActivityItem } from "@/lib/activityFeed";
import { tmdbImageUrl } from "@/lib/library";
import { Text, PressableScale } from "@/components/ui";
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
 * "+N" EXPANDE A LISTA INLINE (2026-10-01, a pedido — antes era só
 * decorativo, tocar não fazia nada) — toque troca `expanded` pra
 * `true` e mostra TODOS os itens do grupo nesta mesma linha, que
 * passa a quebrar (`flexWrap: "wrap"`) em vez de cortar. Com o grupo
 * expandido, o pedaço que antes era o "+N" vira um tile "Ver menos"
 * (mesmo tamanho dos pôsteres) que volta `expanded` pra `false` — a
 * pedido explícito, depois de reportado que não tinha como recolher
 * de novo.
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
  const [expanded, setExpanded] = useState(false);

  const types = new Set(group.items.map((i) => i.activityType));
  const allSameType = types.size === 1;
  const visiblePosters = expanded ? group.items : group.items.slice(0, POSTER_DISPLAY_LIMIT);
  const extraCount = group.items.length - visiblePosters.length;
  const canCollapse = expanded && group.items.length > POSTER_DISPLAY_LIMIT;

  function handlePressMore(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    setExpanded(true);
  }

  function handlePressLess(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    setExpanded(false);
  }

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

      <View style={[styles.postersRow, expanded && styles.postersRowExpanded]}>
        {visiblePosters.map((item) => {
          const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w185") : null;
          return (
            // FEEDBACK DE TOQUE (2026-10-01, a pedido — achado da
            // auditoria UI/UX: pôster clicável sem nenhum retorno
            // visual ao toque) — `PressableScale` em vez de
            // `Pressable` puro; `posterInner` carrega
            // `alignItems`/`justifyContent` (centraliza o ícone de
            // fallback) porque o `Animated.View` interno do
            // `PressableScale` não herda isso do `style` passado (só
            // `flex: 1` — mesmo padrão já usado em
            // `EpisodeWatchedButton.tsx`/`checkWrap`).
            //
            // TAMANHO FIXO SÓ QUANDO EXPANDIDO (2026-10-02, reportado
            // com print — "no emulador ficou numa linha só, no celular
            // quebrou pra 2ª linha") — CAUSA RAIZ: `posterWrap` (91×132
            // fixo) + `postersRow` com `flexWrap: "wrap"` sempre ligado
            // significavam que COUBESSE ou não na largura real da tela,
            // o React Native só tinha 2 saídas — encolher (não fazia,
            // tile tem tamanho FIXO, sem `flexShrink`) ou quebrar linha.
            // No emulador (mais largo) cabia; no aparelho real (mais
            // estreito) não. Recolhido (não expandido — só aqui, o modo
            // "Ver tudo" abaixo continua com o tamanho fixo de sempre),
            // `posterWrapFlex` troca pra `flex: 1` + `aspectRatio`
            // (91/132, a mesma proporção) — os tiles dividem a largura
            // disponível em partes iguais, sempre cabendo numa linha só,
            // em qualquer tamanho de tela.
            <PressableScale key={item.id} style={expanded ? styles.posterWrap : styles.posterWrapFlex} onPress={() => handlePressItem(item)}>
              <View style={styles.posterInner}>
                {posterUrl ? (
                  <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
                ) : (
                  <Feather name="film" size={16} color={colors.muted} />
                )}
              </View>
            </PressableScale>
          );
        })}
        {extraCount > 0 && (
          // Ver comentário grande acima (`posterWrapFlex`) — "+N" só
          // aparece quando NÃO expandido (`extraCount` sempre 0 quando
          // `expanded`), por isso usa sempre a variante flexível, sem
          // condicional.
          <Pressable
            style={styles.morePillFlex}
            onPress={handlePressMore}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("feed.activityGroupShowMore", { count: extraCount })}
          >
            <Text style={styles.morePillText}>+{extraCount}</Text>
          </Pressable>
        )}
        {canCollapse && (
          <Pressable
            style={styles.morePill}
            onPress={handlePressLess}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("feed.activityGroupShowLess")}
          >
            <Feather name="chevron-up" size={18} color={colors.primary} />
            <Text style={styles.lessPillText}>{t("feed.activityGroupShowLess")}</Text>
          </Pressable>
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
  // `flexWrap` (2026-10-01, junto da expansão do "+N") — com o grupo
  // inteiro visível (ex.: 15 itens), uma única linha sem quebra
  // sairia da tela; `gap` já cobre o espaçamento nas duas direções
  // quando quebra pra mais de uma linha.
  //
  // RECOLHIDO NÃO QUEBRA MAIS (2026-10-02) — `flexWrap: "wrap"` saiu
  // do estilo base (agora o padrão é "nowrap"); só é religado via
  // `postersRowExpanded` quando `expanded === true` (grade "Ver
  // tudo", que precisa quebrar linha de propósito). Ver comentário
  // grande em `posterWrapFlex`, abaixo, pra causa raiz completa.
  postersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  postersRowExpanded: {
    flexWrap: "wrap",
  },
  // Ajustado NOVE vezes (2026-10-01, feedback de design) — era 44×64
  // (tier compacto puro); 1ª rodada 56×82; 2ª rodada 62×90 (~+11%
  // sobre 56×82); 3ª rodada 71×104 (+15% sobre 62×90); 4ª rodada
  // 82×120 (+15% sobre 71×104); 5ª rodada 89×130 (+8% sobre 82×120);
  // 6ª rodada 93×135 (+4% sobre 89×130); 7ª rodada 91×132 (-2% sobre
  // 93×135); 8ª rodada 92×133 (+1% sobre 91×132); 9ª rodada
  // (comentário atual) — "foi muito, reverte esses 1%" — de volta a
  // 91×132 (valor da 7ª rodada).
  //
  // Usado SÓ no modo expandido ("Ver tudo") a partir de 2026-10-02 —
  // ver `posterWrapFlex` pra causa raiz; tamanho fixo aqui continua
  // intocado, as 9 rodadas de ajuste acima seguem valendo.
  posterWrap: {
    width: 91,
    height: 132,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  // TAMANHO FLEXÍVEL SÓ NO MODO RECOLHIDO (2026-10-02, reportado com
  // print — "no emulador ficou numa linha só, no celular quebrou pra
  // 2ª linha") — CAUSA RAIZ: `posterWrap` tem largura FIXA (91px); 3
  // pôsteres + a pastilha "+N" (também fixa) davam 4 × 91px + 3 gaps
  // de `spacing.xs`(4px) = 376px, mais o padding horizontal da tela
  // (`spacing.md`×2 = 32px) = 408px mínimos — mais largo que telas
  // reais comuns (~375-393px), mesmo cabendo no emulador (mais largo).
  // Como nada tinha `flexShrink` e a linha tinha `flexWrap: "wrap"`
  // ligado sempre, a única saída era quebrar pra 2ª linha.
  //
  // Correção: no modo recolhido (não expandido), cada tile usa
  // `flex: 1` + `aspectRatio` (91/132, a MESMA proporção das 9
  // rodadas de ajuste) em vez de `width`/`height` fixos — os até 4
  // tiles dividem igualmente a largura disponível da `postersRow`,
  // sempre cabendo numa única linha, em qualquer largura de tela. O
  // modo expandido ("Ver tudo") continua usando `posterWrap` (fixo),
  // sem nenhuma mudança — ele já quebra linha de propósito.
  posterWrapFlex: {
    flex: 1,
    aspectRatio: 91 / 132,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  // Ver comentário de `PressableScale`/`posterInner`, acima — mesmo
  // `alignItems`/`justifyContent` que `posterWrap` tinha antes, só
  // movidos pra dentro do `Animated.View` real (via este `View`).
  posterInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  // Usado SÓ pela pastilha "Ver menos" (sempre no modo expandido —
  // ver `morePillFlex` pra causa raiz); tamanho fixo aqui continua
  // intocado.
  morePill: {
    width: 91,
    height: 132,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  // Variante flexível da pastilha "+N" (2026-10-02) — ver comentário
  // grande em `posterWrapFlex`, acima, pra causa raiz completa. A
  // pastilha "+N" só aparece no modo RECOLHIDO (`extraCount` é sempre
  // 0 quando `expanded === true`, já que aí `visiblePosters` mostra
  // o grupo inteiro), então usa sempre esta variante, sem condicional.
  morePillFlex: {
    flex: 1,
    aspectRatio: 91 / 132,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  morePillText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  // Tile "Ver menos" (2026-10-01, a pedido — mesmo tamanho/estilo do
  // "+N", reaproveita `morePill`) — texto menor que `morePillText`
  // (que é só "+12", bem mais curto) pra caber em 2 linhas sem cortar.
  lessPillText: {
    fontSize: fontSize.xxs,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
});
