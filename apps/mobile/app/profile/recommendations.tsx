import { useState, useCallback, useMemo } from "react";
import { View, Pressable, Alert, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
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
import { Screen, Text, Skeleton, ScreenHeader, GlassTargetProvider, AmbientGlow } from "@/components/ui";
import { colors, radius, spacing, tint, fontSize } from "@/lib/theme";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-169 — porta de `RecommendationsPageView.tsx` do web. Marca
 * como lida ao TOCAR no card (não ao só abrir a tela), mesmo
 * raciocínio do web. Bloquear mora aqui (não em Configurações) por
 * ser a ação mais provável de precisar bem na hora que uma
 * recomendação indesejada chega.
 *
 * CORREÇÃO (a pedido — mesmo achado #3 já corrigido no Perfil,
 * "sem limite nenhum na busca") — `fetchReceivedRecommendations`
 * busca TODA recomendação já recebida, sem limite (correto — é
 * "tudo mesmo", não uma paginação faltando), mas desenhava tudo de
 * uma vez com `ScrollView`+`.map()`. Trocado por `FlatList` — a
 * seção de usuários bloqueados (bem menor, quase sempre) virou
 * `ListFooterComponent`, não precisa de lista própria.
 */
export default function RecommendationsScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" }), [locale]);
  const [recommendations, setRecommendations] = useState<ReceivedRecommendation[] | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  // CORREÇÃO (Fase 3, achado alto — "Ignorar" sem tratamento de erro nem
  // proteção contra toque duplo) — igual ao "Bloquear" ao lado (que já
  // tem seu próprio guard implícito pelo `Alert.alert` de confirmação),
  // "Ignorar" continua SEM confirmação (ação leve, por decisão do
  // usuário) — só ganha guard contra chamada em duplicidade + feedback
  // se a chamada falhar, mesmo padrão de `Alert.alert(t("error.generic"),
  // t("common.tryAgainShortly"))` já usado em `app/lists/[id].tsx`.
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    fetchReceivedRecommendations(locale).then(setRecommendations);
    fetchBlockedUsers().then(setBlockedUsers);
  }, [locale]);

  // CORREÇÃO DE DESEMPENHO (2026-09-27, auditoria de performance —
  // item 4 da Etapa 1B: "Recomendações — useEffect + useFocusEffect")
  // — mesma classe de bug já corrigida em Detalhes da Série na Etapa
  // 1A: `useFocusEffect` (do próprio `expo-router`) já dispara na
  // MONTAGEM inicial da tela e em todo refoco — o `useEffect(reload,
  // [reload])` ao lado disparava de novo na mesma montagem (2 buscas
  // completas — `fetchReceivedRecommendations` + `fetchBlockedUsers` —
  // 2x cada, 4 chamadas de rede só pra abrir a tela). Removido o
  // `useEffect`; `useFocusEffect` sozinho já cobre tanto a montagem
  // quanto voltar pra esta tela depois de sair dela (comportamento de
  // atualização ao focar, preservado). Troca de idioma com a tela já
  // aberta não passa por aqui de propósito: esta tela não tem seletor
  // de idioma próprio — mudar o idioma sempre exige navegar até
  // Configurações e voltar, o que já é, em si, um evento de foco.
  useFocusEffect(reload);

  function handleOpen(rec: ReceivedRecommendation) {
    if (!rec.readAt) {
      markRecommendationRead(rec.id).then(reload);
    }
    const base = rec.mediaType === "movie" ? `/movies/${rec.mediaId}` : `/series/${rec.mediaId}`;
    router.push(`${base}?recId=${rec.id}`);
  }

  function handleDismiss(id: string) {
    if (dismissingIds.has(id)) return;
    setDismissingIds((prev) => new Set(prev).add(id));
    dismissRecommendation(id)
      .then(reload)
      .catch((error) => {
        console.error("[RecommendationsScreen] Falha ao ignorar recomendação", error);
        Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
      })
      .finally(() => {
        setDismissingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }

  function handleBlock(rec: ReceivedRecommendation) {
    Alert.alert(t("profile.blockUserTitle", { username: rec.sender.username }), t("profile.blockUserMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.block"),
        style: "destructive",
        onPress: () => blockUser(rec.sender.userId).then(reload),
      },
    ]);
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("profile.recommendationsTitle")} />

      {/*
        * CORREÇÃO (bug real, reportado — "nenhuma dessas telas tem as
        * manchas azuis de fundo") — mesma correção de `favorite-series.tsx`
        * (ver comentário lá): `SUBPAGE_GLOW_BLOBS`, já usada em
        * `comments.tsx`/`edit-profile.tsx`.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      {recommendations === null ? (
        <View style={[styles.content, { gap: spacing.sm }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.card}>
              <Skeleton width={56} height={80} borderRadius={radius.sm} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Skeleton width="70%" height={12} />
                <Skeleton width="50%" height={14} />
                <Skeleton width="40%" height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={recommendations}
          keyExtractor={(rec) => rec.id}
          contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
          ListEmptyComponent={<EmptyState message={t("profile.noRecommendationsYet")} />}
          renderItem={({ item: rec }) => (
            <View style={[styles.card, !rec.readAt && styles.cardUnread]}>
              <Pressable style={styles.cardMain} onPress={() => handleOpen(rec)}>
                <View style={styles.poster}>
                  {rec.posterPath && (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w185${rec.posterPath}` }} style={styles.posterImage} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="muted" style={styles.senderLine}>
                    <Text style={styles.senderName}>{rec.sender.displayName ?? `@${rec.sender.username}`}</Text>{" "}
                    {t("profile.recommendedVerb")}
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
                <Pressable onPress={() => handleDismiss(rec.id)} disabled={dismissingIds.has(rec.id)} hitSlop={8}>
                  <Feather name="x" size={16} color={colors.muted} />
                </Pressable>
                <Pressable onPress={() => handleBlock(rec)} hitSlop={8}>
                  <Feather name="slash" size={16} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListFooterComponent={
            blockedUsers.length > 0 ? (
              <View style={styles.blockedSection}>
                <Pressable style={styles.blockedToggle} onPress={() => setShowBlocked((v) => !v)}>
                  <Text variant="muted" style={styles.blockedToggleText}>
                    {t("profile.blockedUsersCount", { count: blockedUsers.length })}
                  </Text>
                  <Feather name={showBlocked ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
                </Pressable>

                {showBlocked &&
                  blockedUsers.map((user) => (
                    <View key={user.userId} style={styles.blockedRow}>
                      <Text style={styles.blockedName}>{user.displayName ?? `@${user.username}`}</Text>
                      <Pressable onPress={() => unblockUser(user.userId).then(reload)}>
                        <Text style={styles.unblockText}>{t("profile.unblock")}</Text>
                      </Pressable>
                    </View>
                  ))}
              </View>
            ) : null
          }
        />
      )}
      </GlassTargetProvider>
    </Screen>
  );
}

/**
 * CORREÇÃO (2026-09-15, bug real, reportado com print — "deixa o
 * mobile igual ao web") — o estado vazio desta tela usava
 * `<EmptyShelf icon="send" .../>` (o card com borda tracejada +
 * vidro + círculo de ícone, mesmo componente usado no Perfil, nas
 * prateleiras de Séries/Filmes etc.). Conferido o
 * `RecommendationsPageView.tsx` do web: aqui ele usa um componente
 * DIFERENTE — `EmptyState` (`components/search/EmptyState.tsx`,
 * `py-16` + texto centralizado, SEM card nenhum, SEM ícone, SEM
 * borda) — não é o mesmo padrão de estado vazio das prateleiras.
 * Print comparando os dois confirmou: no web esta tela específica
 * mostra só o texto solto no meio, nada mais.
 *
 * Componente local (mesmo padrão já usado em
 * `components/explore/SearchResults.tsx` pra este caso — texto
 * solto, sem wrapper de card) em vez de reusar `EmptyShelf`, que
 * continua certo pras prateleiras que de fato usam esse visual no
 * web.
 */
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
  content: {
    padding: spacing.md,
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
    borderColor: tint.border,
    backgroundColor: tint.subtle,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — tokens formalizados `fontSize.xs`/`fontSize.sm`/`fontSize.micro` (eram literais 12/14/10, mesmos valores).
  senderLine: { fontSize: fontSize.xs },
  senderName: { fontWeight: "700", color: colors.text },
  mediaTitle: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginTop: 2 },
  message: { fontSize: fontSize.xs, marginTop: 2 },
  date: { fontSize: fontSize.micro, marginTop: spacing.xs },
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
  blockedToggleText: { fontSize: fontSize.xs, fontWeight: "500" },
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
  blockedName: { fontSize: fontSize.sm, color: colors.text },
  unblockText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.primary },
  /** Web (`EmptyState.tsx`): `flex flex-col items-center justify-center gap-1 py-16 text-center` — py-16=64, gap-1=4. */
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 64,
  },
  /** Web: `text-sm text-muted` = 14/`colors.muted` — mesmo par já usado no resto do app (`variant="muted"` do `Text` já dá a cor; só falta o fontSize.sm=14, que já é o padrão do variant). */
  emptyStateText: {
    textAlign: "center",
  },
});
