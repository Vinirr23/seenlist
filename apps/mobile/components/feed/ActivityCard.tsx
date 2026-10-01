import { useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { ActivityItem } from "@/lib/activityFeed";
import { tmdbImageUrl } from "@/lib/library";
import { fetchMovieStatusDetails, setMovieStatus } from "@/lib/movieDetails";
import { fetchSeriesStatus, setSeriesStatus } from "@/lib/seriesDetails";
import { Text } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { AnimatedStar } from "./AnimatedStar";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useNow } from "@/lib/useNow";
import { formatRelativeTime } from "@/lib/relativeTime";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

type QuickAddState = "idle" | "checking" | "hasStatus" | "added" | "error";

/**
 * HOOK COMPARTILHADO DE "+" RÁPIDO (2026-10-01, extraído da
 * `CompletedActivityHeroCard` — a pedido, "todo card que apareça,
 * tenha o (+) igual em explorar", escopo confirmado como SÓ os cards
 * de atividade, NUNCA `PostCard`/post social de verdade) — mesma
 * lógica de sempre (confere status atual só NO TOQUE do botão, nunca
 * ao montar o card; nunca REBAIXA quem já está
 * "assistindo"/"assistido"/"terminado" de volta pra "assistir
 * depois"), agora reaproveitada pelas 3 variantes de card
 * (hero/médio/compacto) em vez de só a hero ter o botão.
 */
function useQuickAdd(item: ActivityItem) {
  const [state, setState] = useState<QuickAddState>("idle");

  async function handleQuickAdd(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    if (state !== "idle") return;
    setState("checking");
    try {
      if (item.mediaType === "movie") {
        const { status } = await fetchMovieStatusDetails(item.mediaId);
        if (status) {
          setState("hasStatus");
          return;
        }
        await setMovieStatus(item.mediaId, "want_to_watch", null);
      } else {
        const status = await fetchSeriesStatus(item.mediaId);
        if (status) {
          setState("hasStatus");
          return;
        }
        await setSeriesStatus(item.mediaId, "want_to_watch", null);
      }
      setState("added");
    } catch (error) {
      console.error("[ActivityCard] Falha ao adicionar rápido à lista", error);
      setState("error");
    }
  }

  return { state, handleQuickAdd };
}

/**
 * BOTÃO "+" — versão "inline" (2026-10-01, a pedido) pros cards
 * médio/compacto: mesmos 3 estados visuais do botão da hero
 * (idle/checking/concluído), mas SEM o fundo semitransparente sobre
 * imagem (não tem imagem de fundo imprevisível atrás, é o fundo do
 * app mesmo) — usa `colors.surface` em vez de
 * `"rgba(11,14,20,0.55)"`. Fica no canto superior direito do card
 * (posição absoluta), igual à hero.
 *
 * ÍCONE TROCADO DE "+"/CHECK PRA BOOKMARK (2026-10-01, feedback de
 * design explícito — "o + aparece demais e começa a virar ruído
 * visual; se significa watchlist, eu prefiro bookmark e, se o título
 * já estiver na lista, mostrar o estado preenchido") — mesma ação de
 * sempre (adiciona à "assistir depois"), só o ícone/estado visual
 * mudou: contorno (`bookmark-outline`) quando ainda não tem status,
 * preenchido (`bookmark`, cor âmbar) quando já tem QUALQUER status
 * (não só quando ESTE botão adicionou — `hasStatus` cobre "já estava
 * na lista/assistindo/terminado antes de tocar aqui" também).
 */
function QuickAddButtonInline({ item }: { item: ActivityItem }) {
  const { t } = useTranslation();
  const { state, handleQuickAdd } = useQuickAdd(item);
  const addDone = state === "hasStatus" || state === "added";
  const addBusy = state === "checking";

  return (
    <Pressable
      style={styles.quickAddButtonInline}
      onPress={handleQuickAdd}
      disabled={state !== "idle"}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t("feed.quickAddToWatchlist")}
    >
      {addBusy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : addDone ? (
        <Ionicons name="bookmark" size={15} color={colors.primary} />
      ) : (
        <Ionicons name="bookmark-outline" size={15} color={colors.primary} />
      )}
    </Pressable>
  );
}

/**
 * ACTIVITY CARD (2026-10-01, documento de UX — "transformaria ações
 * do SeenList em posts visuais", prioridade #1 escolhida) — card
 * SEM curtida/comentário/apagar (não é um post de verdade, é um
 * reflexo de `series_status`/`movie_status`/`reviews` — ver
 * `lib/activityFeed.ts`): só avatar+nome+ação. Toque no poster/título
 * leva pro detalhe da mídia; toque no nome/avatar leva pro perfil
 * (mesma divisão do `PostCard`).
 *
 * HIERARQUIA POR IMPORTÂNCIA (2026-10-01, feedback de design explícito
 * — "a importância da ação passa a determinar o peso visual") —
 * substituiu a divisão anterior (só "completed" vs. resto). Três
 * níveis agora:
 *   - "completed" ELEGÍVEL pra hero (ver `heroEligible`, calculado em
 *     `lib/useFeedEntries.ts` — no máx. 1 em cada 5-7 itens, pedido
 *     explícito: "se houver muitos finished, o feed vira uma
 *     sequência de banners enormes") → `CompletedActivityHeroCard`
 *     (pôster em tela cheia).
 *   - "completed" NÃO elegível (throttled) → `StandardActivityCard`
 *     tier="compact" — mesmo tamanho visual de "adicionou à lista",
 *     mas mantém o ícone de check e o verbo "terminou/assistiu"
 *     (continua semanticamente uma conclusão, só não ganha o
 *     tratamento grande).
 *   - "rated" (tem estrelas) → tier="medium" (pôster maior, mesmo
 *     tamanho já usado em `PostCard.tsx` pra review com texto).
 *   - "watchlist" → tier="compact" (pôster pequeno).
 *
 * BOTÃO "+" (2026-10-01, a pedido — "todo card que apareça, tenha o
 * (+) igual em explorar", escopo confirmado: SÓ cards de atividade) —
 * as 3 variantes (hero/médio/compacto) têm o botão agora, via
 * `useQuickAdd`/`QuickAddButtonInline` acima.
 */
export function ActivityCard({ item, heroEligible = false }: { item: ActivityItem; heroEligible?: boolean }) {
  if (item.activityType === "completed") {
    if (heroEligible) return <CompletedActivityHeroCard item={item} />;
    return <StandardActivityCard item={item} tier="compact" />;
  }
  if (item.activityType === "rated") return <StandardActivityCard item={item} tier="medium" />;
  return <StandardActivityCard item={item} tier="compact" />;
}

function StandardActivityCard({ item, tier }: { item: ActivityItem; tier: "medium" | "compact" }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const now = useNow(30_000);
  const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w342") : null;

  const verb =
    item.activityType === "rated"
      ? t("feed.activityRated")
      : item.activityType === "watchlist"
        ? t("feed.activityWatchlist")
        : item.mediaType === "series"
          ? t("feed.activityCompletedSeries")
          : t("feed.activityCompletedMovie");

  function handlePressMedia() {
    router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`);
  }

  function handlePressUser(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    router.push(`/u/${item.userUsername}`);
  }

  return (
    <Pressable onPress={handlePressMedia} style={[styles.card, tier === "compact" && styles.cardCompact]}>
      <View style={styles.headerRow}>
        <Pressable style={styles.header} onPress={handlePressUser}>
          <Avatar uri={item.userAvatarUrl} name={item.userName} style={styles.avatar} textStyle={styles.avatarInitials} />
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text numberOfLines={1} style={styles.authorName}>
                {item.userName}
              </Text>
              <VerifiedBadge tier={item.userVerifiedTier} size={fontSize.sm} />
              <Text numberOfLines={1} variant="muted" style={styles.meta}>
                {formatRelativeTime(item.createdAt, now, locale, t("feed.justNow"))}
              </Text>
            </View>
            <View style={styles.verbRow}>
              {item.activityType === "watchlist" ? (
                <Feather name="bookmark" size={11} color={colors.primary} />
              ) : item.activityType === "completed" ? (
                <Feather name="check-circle" size={11} color={colors.success} />
              ) : null}
              <Text variant="muted" style={styles.verb}>
                {verb}
              </Text>
            </View>
          </View>
        </Pressable>
      </View>

      <View style={styles.mediaRow}>
        <View style={tier === "medium" ? styles.posterMedium : styles.posterCompact}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
          ) : (
            <Feather name="film" size={tier === "medium" ? 22 : 16} color={colors.muted} />
          )}
        </View>
        <View style={styles.mediaInfo}>
          <Text numberOfLines={2} style={styles.mediaTitle}>
            {item.mediaTitle}
          </Text>
          {item.activityType === "rated" && (
            <View style={styles.starsRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <AnimatedStar
                  key={i}
                  index={i}
                  filled={i < Math.round(item.rating ?? 0)}
                  size={16}
                  color={colors.primary}
                  emptyColor={colors.border}
                />
              ))}
              <Text style={styles.ratingText}>{(item.rating ?? 0).toFixed(1)}/5</Text>
            </View>
          )}
        </View>
      </View>

      <QuickAddButtonInline item={item} />
    </Pressable>
  );
}

/**
 * CARD GRANDE DE "TERMINOU/ASSISTIU" (2026-10-01, a pedido — porte de
 * layout visual de outro app, aprovado pelo usuário: pôster em tela
 * cheia + botão "+" de adicionar rápido). AVISO DE DESEMPENHO (regra
 * permanente do projeto) — pôster aqui é `w500` (era `w342` no card
 * pequeno, ainda maior que o antigo `w185` dos posts comuns): imagem
 * MAIOR por card nesta lista virtualizada custa mais memória/banda
 * que o card pequeno de antes. Com o THROTTLE de hero (2026-10-01,
 * feedback de design — "limitaria a um Hero a cada 5-7 itens"), esses
 * cards "w500" ficaram ainda mais raros no Feed (no máx. 1 em cada 6,
 * ver `HERO_MIN_GAP` em `lib/useFeedEntries.ts`) — o resto dos
 * "completed" cai pro card compacto (`w342`, igual aos outros).
 *
 * BOTÃO "+" — adiciona à "assistir depois" sem abrir a tela do
 * título, só pra quem AINDA não tem status nenhum pra essa mídia
 * (confere antes de escrever via `useQuickAdd`, acima — nunca REBAIXA
 * quem já está "assistindo"/"assistido"/"terminado" de volta pra
 * "assistir depois"). Busca o status atual só NO TOQUE do botão, não
 * ao montar o card.
 */
function CompletedActivityHeroCard({ item }: { item: ActivityItem }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const now = useNow(30_000);
  const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w500") : null;
  const { state: quickAdd, handleQuickAdd } = useQuickAdd(item);

  function handlePressMedia() {
    router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`);
  }

  function handlePressUser(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    router.push(`/u/${item.userUsername}`);
  }

  const verb = item.mediaType === "series" ? t("feed.activityCompletedSeries") : t("feed.activityCompletedMovie");
  const addDone = quickAdd === "hasStatus" || quickAdd === "added";
  const addBusy = quickAdd === "checking";

  return (
    <Pressable onPress={handlePressMedia} style={styles.heroCard}>
      <View style={styles.heroImageWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroImageFallback]}>
            <Feather name="film" size={32} color={colors.muted} />
          </View>
        )}

        <LinearGradient colors={["rgba(11,14,20,0.75)", "rgba(11,14,20,0)"]} locations={[0, 1]} style={styles.heroTopScrim} pointerEvents="none" />
        <LinearGradient
          colors={["rgba(11,14,20,0)", "rgba(11,14,20,0.6)", colors.background]}
          locations={[0, 0.55, 1]}
          style={styles.heroBottomScrim}
          pointerEvents="none"
        />

        <Pressable style={styles.heroHeader} onPress={handlePressUser} hitSlop={4}>
          <Avatar uri={item.userAvatarUrl} name={item.userName} style={styles.heroAvatar} textStyle={styles.heroAvatarInitials} />
          <View style={styles.heroHeaderText}>
            <View style={styles.heroNameRow}>
              <Text numberOfLines={1} style={styles.heroAuthorName}>
                {item.userName}
              </Text>
              <VerifiedBadge tier={item.userVerifiedTier} size={fontSize.sm} />
            </View>
            <Text numberOfLines={1} style={styles.heroMeta}>
              {formatRelativeTime(item.createdAt, now, locale, t("feed.justNow"))}
            </Text>
          </View>
        </Pressable>

        {/*
         * MANTIDO "+"/CHECK NA HERO, NÃO BOOKMARK (2026-10-01, pedido
         * explícito — "essas hero 'watched' quero que tenha o (+) já
         * que os demais posts são a bandeirinha") — o bookmark
         * (`QuickAddButtonInline`, acima) virou a linguagem visual dos
         * cards médio/compacto; a Hero fica diferente de propósito,
         * com o ícone original "+"/check + a caixa que muda de cor
         * (borda/fundo âmbar → verde) pra indicar o estado concluído,
         * já que aqui não tem outro ícone de bookmark por perto
         * competindo por atenção (ao contrário dos cards pequenos, que
         * já mostram um bookmark no `verbRow` pra "adicionou à
         * lista").
         */}
        <Pressable
          style={[styles.quickAddButton, addDone && styles.quickAddButtonDone]}
          onPress={handleQuickAdd}
          disabled={quickAdd !== "idle"}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("feed.quickAddToWatchlist")}
        >
          {addBusy ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : addDone ? (
            <Feather name="check" size={16} color={colors.background} />
          ) : (
            <Feather name="plus" size={16} color={colors.primary} />
          )}
        </Pressable>

        <View style={styles.heroFooter}>
          <View style={styles.heroTitleRow}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text numberOfLines={2} style={styles.heroTitle}>
              {item.mediaTitle}
            </Text>
          </View>
          <Text style={styles.heroVerb}>{verb}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Mesma receita visual de `PostCard.tsx` ("feed igual Threads") — sem fundo/borda ao redor, só a linha fina embaixo separando do próximo item.
  // `paddingRight` reserva espaço pro botão de watchlist (posição absoluta, canto superior direito) não cobrir nome/hora compridos.
  card: {
    paddingVertical: spacing.md,
    paddingRight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // Tier "compacto" (2026-10-01, feedback de design — "reduziria um
  // pouco a altura vertical dos posts simples; hoje há bastante espaço
  // vazio entre título e divisor") — o pôster compacto (44×64) é bem
  // mais baixo que o padding vertical de `card` reservava; reduzido só
  // pra este tier (o "médio", com pôster 126 de altura, continua
  // usando o padding normal — ele precisa do espaço).
  cardCompact: {
    paddingVertical: spacing.sm,
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
  mediaRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  // Tier "médio" (2026-10-01, hierarquia por importância — "avaliou") — mesmo tamanho já usado em `PostCard.tsx` (`reviewPoster`) pra consistência visual entre os dois lugares do Feed que mostram pôster com texto ao lado.
  posterMedium: {
    width: 84,
    height: 126,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Tier "compacto" (2026-10-01, hierarquia por importância — "adicionou à lista" e "terminou" fora do throttle de hero) — pôster pequeno, peso visual mínimo.
  posterCompact: {
    width: 44,
    height: 64,
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
  mediaInfo: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  mediaTitle: {
    fontSize: fontSize.smPlus,
    fontWeight: "700",
    color: colors.text,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    marginLeft: spacing.xs,
    fontSize: fontSize.xxs,
    fontWeight: "600",
    color: colors.muted,
  },

  // --- Botão de watchlist inline (médio/compacto) ---
  // SIMPLIFICADO (2026-10-01, feedback de design — "o + aparece demais
  // e começa a virar ruído visual") — era uma caixinha com borda +
  // fundo (`colors.surface`/borderWidth 1.5), competindo visualmente
  // com o resto do card. Virou só o ícone (contorno/preenchido, ver
  // `QuickAddButtonInline` acima), sem caixa ao redor — ainda com área
  // de toque confortável via `hitSlop`.
  quickAddButtonInline: {
    position: "absolute",
    top: spacing.md,
    right: spacing.sm,
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  // --- CompletedActivityHeroCard (card grande de "terminou/assistiu") ---
  heroCard: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  /**
   * BUG REAL CORRIGIDO (2026-10-01, reportado — "ficou muito grande")
   * — era `2/3` (proporção de pôster de verdade, alto e estreito):
   * com a largura do card inteira, isso virava um card quase do
   * tamanho da tela. A referência enviada pelo usuário é bem mais
   * baixa/larga (~4:3) — a imagem (mesmo pôster, `contentFit: "cover"`
   * já corta o excesso) passa a preencher uma caixa mais curta, igual
   * à referência, em vez do pôster inteiro em pé.
   */
  heroImageWrapper: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImageFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroTopScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "30%",
  },
  // Caixa mais baixa (ver `heroImageWrapper`) = menos altura sobrando pro texto embaixo — percentual maior pra manter título/verbo legíveis sem precisar de tanto espaço vertical quanto na caixa alta original.
  heroBottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  heroHeader: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.sm,
    right: 56, // espaço pro botão "+" no canto, pra não sobrepor nome comprido
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatarInitials: {
    fontSize: fontSize.xxs,
    fontWeight: "700",
    color: colors.muted,
  },
  heroHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroAuthorName: {
    flexShrink: 1,
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  heroMeta: {
    marginTop: 1,
    fontSize: fontSize.xxs,
    color: colors.muted,
  },
  quickAddButton: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: "rgba(11,14,20,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  // BUG REAL CORRIGIDO (2026-10-01, reportado — "ao marcar o botão
  // ficou preenchido em verde, o padrão do app é âmbar") — era
  // `colors.success` (verde), inconsistente com o resto do app: o
  // "+"/check da Hero é a única cor de destaque que existe sobre a
  // imagem, então devia seguir a mesma cor-marca (`colors.primary`,
  // âmbar) que todo o resto do app usa pra ação/destaque — verde aqui
  // ficava parecendo um sistema de cores à parte, não o SeenList.
  quickAddButtonDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  heroFooter: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    gap: 4,
  },
  heroTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  heroVerb: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
});
