import { useEffect, useState, useCallback } from "react";
import { View, Pressable, Alert, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyLists, fetchListItems, removeFromList, deleteList, removeCoOwner, leaveSharedList, type UserList, type ListItem } from "@/lib/lists";
import { InviteCoOwnerSheet } from "@/components/social/InviteCoOwnerSheet";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { PageError } from "@/components/media/PageError";
import { Avatar } from "@/components/common/Avatar";
import { Screen, Text, Skeleton, PressableScale, GlassTargetProvider, AmbientGlow, ScreenHeader } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { hapticTick } from "@/lib/haptics";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-172 — porta de `ListDetailView.tsx` do web.
 *
 * CORREÇÃO (a pedido — mesmo achado #3 já corrigido no Perfil,
 * "sem limite nenhum na busca") — `fetchListItems` busca TODO item
 * de uma lista, sem limite (correto — uma lista custom pode crescer
 * bastante com o tempo). Trocado `ScrollView`+`.map()` por `FlatList`
 * (`numColumns={3}`, virtualizada).
 *
 * REDESIGN "DETALHE DA LISTA" (2026-10-07, aprovado pelo usuário —
 * ver `claude/SEENLIST-FEATURE-2026-10-07-redesign-detalhe-lista.md`)
 * — auditoria prévia aprovada, depois implementação. Três mudanças
 * principais, nenhuma de dado/permissão, só de apresentação:
 *
 * 1. O "X" permanente em cima de todo pôster virou um "•••" discreto
 *    (`scrim.control`, sem círculo grande) que abre o `OptionSheet`
 *    já usado em `PostCard.tsx`/`SeasonAccordion`/tela de episódio
 *    pra "Remover da lista" — mesmo padrão de menu que já existe no
 *    app em 3 lugares, não um gesto novo (`long press` não tem
 *    nenhum precedente no app; "modo de edição" também não).
 * 2. "Apagar lista" (dono) e "Sair da lista" (co-dono) saíram de
 *    ícones soltos no `right` do header e viraram a mesma ação via
 *    "•••" único — reduz a competição visual com o título, sem mudar
 *    NENHUMA regra de permissão (o `Alert.alert` de confirmação que
 *    já existia pros dois continua exatamente igual, só é disparado
 *    de dentro do `OptionSheet` agora).
 * 3. "Convidar pra co-dono"/status de co-dono viraram uma pill
 *    compacta (mesma linguagem visual de `GenreChips.tsx` — `tint.subtle`
 *    + `radius.full`) em vez de uma linha de largura total com o
 *    mesmo peso tipográfico de uma ação primária.
 *
 * Pôster em si: saiu do `<Glass>` (era o mesmo excesso que a grade de
 * "Minhas listas" já tinha tirado) — agora é `Image` pura com
 * `radius.poster`, dentro de `PressableScale`.
 *
 * Erro de busca (achado real da auditoria, não documentado antes) —
 * esta tela nunca tratava falha de `fetchMyLists`/`fetchListItems`;
 * ficava presa no skeleton pra sempre. Agora usa `PageError` (mesmo
 * padrão de `lists/index.tsx`).
 */
export default function ListDetailScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [list, setList] = useState<UserList | null>(null);
  const [items, setItems] = useState<ListItem[] | null>(null);
  const [isError, setIsError] = useState(false);
  const cardWidth = usePosterCardWidth();
  // LISTA COMPARTILHADA (2026-10-06) — ver
  // `claude/SEENLIST-FEATURE-2026-10-06-lista-compartilhada.md`.
  const [showInvite, setShowInvite] = useState(false);
  // REDESIGN (2026-10-07) — qual "•••" está aberto no momento. Só um
  // de cada vez: o do cabeçalho (apagar lista/sair), o do co-dono
  // (remover co-dono) e o de um pôster específico (remover item) são
  // estados independentes porque cada um tem ações diferentes.
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [coOwnerMenuOpen, setCoOwnerMenuOpen] = useState(false);
  const [activeItemMenu, setActiveItemMenu] = useState<ListItem | null>(null);
  // `fetchMyLists()` só retorna listas que a RLS deixa EU ver (dono OU
  // co-dono) — se a lista veio e `isCoOwnedByMe` é falso, só pode ser
  // porque sou o dono original.
  const isOwner = list !== null && !list.isCoOwnedByMe;

  const reload = useCallback(() => {
    setIsError(false);
    fetchMyLists()
      .then((lists) => setList(lists.find((l) => l.id === id) ?? null))
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao buscar lista", error);
        setIsError(true);
      });
    fetchListItems(id, locale)
      .then(setItems)
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao buscar itens da lista", error);
        setIsError(true);
      });
  }, [id, locale]);

  useEffect(reload, [reload]);
  useFocusEffect(reload);

  /**
   * FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
   * 2026-09-26) — achado real: sem haptic e sem tratamento de erro —
   * uma falha na rede não avisava nada, o item só continuava ali sem
   * explicação. Critério do próprio usuário ("ação reversível e de
   * baixo impacto → feedback imediato"): continua SEM confirmação (é
   * reversível, dá pra adicionar de novo) — só ganhou o haptic que
   * toda outra ação rápida do app já tem, e um aviso quando falha.
   *
   * REDESIGN (2026-10-07) — comportamento (haptic, sem confirmação,
   * alerta de erro) preservado 1:1; só mudou QUEM chama esta função
   * (antes: `onPress` direto do "X"; agora: ação dentro do
   * `OptionSheet` do pôster).
   */
  function handleRemove(itemId: string) {
    hapticTick();
    removeFromList(itemId)
      .then(reload)
      .catch((error) => {
        console.error("[ListDetailScreen] Falha ao remover item da lista", error);
        Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
      });
  }

  function handleDeleteList() {
    Alert.alert(t("profile.deleteListTitle"), t("profile.deleteListMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("social.delete"),
        style: "destructive",
        onPress: () => deleteList(id).then(() => router.replace("/lists")),
      },
    ]);
  }

  // LISTA COMPARTILHADA (2026-10-06) — dono remove o co-dono (aceito
  // ou ainda pendente — mesma ação do ponto de vista do banco: zera os
  // dois campos). Itens que o co-dono adicionou ficam na lista.
  function handleRemoveCoOwner() {
    if (!list?.coOwner) return;
    const name = list.coOwner.displayName ?? `@${list.coOwner.username}`;
    Alert.alert(t("profile.removeCoOwnerTitle", { name }), t("profile.removeCoOwnerMessage", { name }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.removeCoOwnerAction"),
        style: "destructive",
        onPress: () =>
          removeCoOwner(id, list.name, list.coOwner!.userId)
            .then(reload)
            .catch((error) => {
              console.error("[ListDetailScreen] Falha ao remover co-dono", error);
              Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
            }),
      },
    ]);
  }

  // Co-dono sai por conta própria. Não apaga a lista nem os itens que já adicionou.
  function handleLeaveSharedList() {
    if (!list) return;
    Alert.alert(t("profile.leaveSharedListTitle"), t("profile.leaveSharedListMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.leaveSharedListAction"),
        style: "destructive",
        onPress: () =>
          leaveSharedList(id, list.name, list.ownerId)
            .then(() => router.replace("/lists"))
            .catch((error) => {
              console.error("[ListDetailScreen] Falha ao saír da lista compartilhada", error);
              Alert.alert(t("error.generic"), t("common.tryAgainShortly"));
            }),
      },
    ]);
  }

  const isLoading = items === null && !isError;

  return (
    <Screen padded={false}>
      <ScreenHeader
        title={list?.name ?? t("profile.listFallbackName")}
        /*
         * REDESIGN (2026-10-07) — era um ícone de ação direto
         * (lixeira pro dono, "sair" pro co-dono). Os DOIS viram o
         * mesmo "•••" — abre o `OptionSheet` com a ação certa pro
         * papel de quem está vendo (ver abaixo). Nenhuma permissão
         * mudou: quem podia apagar continua só podendo apagar, quem
         * podia sair continua só podendo sair.
         */
        right={
          isOwner || (list?.isCoOwnedByMe && list.coOwner?.status === "accepted") ? (
            <Pressable onPress={() => setHeaderMenuOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("profile.moreOptions")}>
              <Feather name="more-horizontal" size={20} color={colors.muted} />
            </Pressable>
          ) : undefined
        }
      />

      {/*
        POLISH (2026-10-07, rodada 2 — "a área superior está um pouco
        fragmentada") — "3 títulos" e a pill de co-dono viram uma linha
        só (`space-between`), em vez de duas linhas empilhadas. Os dois
        lados são independentes de propósito (`metaLeft` só aparece
        quando `items` carrega; a pill só depende de `list`/`isOwner`)
        pra pill não "esperar" os itens carregarem pra aparecer — isso
        não é mudança de comportamento, só evita que o layout pule.
      */}
      {(list || isOwner) && (
        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            {list && items !== null && (
              <Text variant="muted" style={styles.countText}>
                {items.length === 1 ? t("profile.oneListItem") : t("profile.listItemsCount", { count: items.length })}
              </Text>
            )}
          </View>
          {/*
            LISTA COMPARTILHADA (2026-10-06) — pill só pro DONO (co-dono
            não tem direito sobre a lista em si, só sobre os itens —
            decisão confirmada, preservada igual nesta rodada).
            POLISH (2026-10-07, rodada 2 — "chamando atenção demais,
            pill âmbar virou o 2º elemento mais importante da tela") —
            fundo neutro (`colors.surface`+`colors.border`, não mais
            `tint.subtle` âmbar) e texto `muted`; o âmbar sobra só no
            ícone de convite (único "toque" de cor aqui).
          */}
          {isOwner && (
            list?.coOwner ? (
              <Pressable style={styles.coOwnerPill} onPress={() => setCoOwnerMenuOpen(true)}>
                <Avatar
                  uri={list.coOwner.avatarUrl}
                  name={list.coOwner.displayName ?? list.coOwner.username}
                  style={styles.coOwnerAvatar}
                  textStyle={styles.coOwnerAvatarInitials}
                />
                <Text numberOfLines={1} style={styles.coOwnerPillText}>
                  {list.coOwner.status === "accepted" ? (list.coOwner.displayName ?? `@${list.coOwner.username}`) : t("profile.coOwnerPendingBadge")}
                </Text>
              </Pressable>
            ) : (
              <Pressable style={styles.coOwnerPill} onPress={() => setShowInvite(true)}>
                <Feather name="user-plus" size={13} color={colors.primary} />
                <Text style={styles.invitePillText}>{t("profile.invitePillLabel")}</Text>
              </Pressable>
            )
          )}
        </View>
      )}

      {showInvite && list && (
        <InviteCoOwnerSheet listId={id} listName={list.name} onClose={() => setShowInvite(false)} onInvited={reload} />
      )}

      {headerMenuOpen && list && (
        <OptionSheet
          title={list.name}
          onDismiss={() => setHeaderMenuOpen(false)}
          actions={
            isOwner
              ? [
                  {
                    label: t("profile.deleteListAction"),
                    danger: true,
                    onPress: () => {
                      setHeaderMenuOpen(false);
                      handleDeleteList();
                    },
                  },
                ]
              : [
                  {
                    label: t("profile.leaveSharedListAction"),
                    danger: true,
                    onPress: () => {
                      setHeaderMenuOpen(false);
                      handleLeaveSharedList();
                    },
                  },
                ]
          }
        />
      )}

      {coOwnerMenuOpen && list?.coOwner && (
        <OptionSheet
          title={list.coOwner.displayName ?? `@${list.coOwner.username}`}
          onDismiss={() => setCoOwnerMenuOpen(false)}
          actions={[
            {
              label: t("profile.removeCoOwnerAction"),
              danger: true,
              onPress: () => {
                setCoOwnerMenuOpen(false);
                handleRemoveCoOwner();
              },
            },
          ]}
        />
      )}

      {activeItemMenu && (
        <OptionSheet
          title={activeItemMenu.title}
          onDismiss={() => setActiveItemMenu(null)}
          actions={[
            {
              label: t("profile.removeFromListAction"),
              danger: true,
              onPress: () => {
                const itemId = activeItemMenu.id;
                setActiveItemMenu(null);
                handleRemove(itemId);
              },
            },
          ]}
        />
      )}

      {/* PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas das sub-telas (ver `lib/glowBlobs.ts`). */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      {isLoading ? (
        <View style={[styles.content, styles.grid]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: cardWidth }}>
              {/* REDESIGN (2026-10-07) — altura calculada a partir do MESMO `cardWidth`/aspect ratio 2:3 do pôster real (era 160 fixo, não acompanhava a largura real da coluna). */}
              <Skeleton width={cardWidth} height={Math.round(cardWidth * 1.5)} borderRadius={radius.poster} />
            </View>
          ))}
        </View>
      ) : isError ? (
        <PageError message={t("error.loadListFailed")} onRetry={reload} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={<EmptyShelf icon="film" message={t("profile.emptyListMessage")} />}
          renderItem={({ item }) => (
            <View style={{ width: cardWidth }}>
              {/* REDESIGN (2026-10-07) — pôster saiu do `<Glass>` (era o mesmo excesso que a grade de "Minhas listas" já tinha removido); agora é `Image` pura com `radius.poster`. */}
              <PressableScale
                onPress={() => router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`)}
              >
                <View style={styles.poster}>
                  {item.posterPath ? (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w342${item.posterPath}` }} style={styles.posterImage} />
                  ) : (
                    <View style={styles.posterFallback}>
                      <Feather name="film" size={20} color={colors.muted} />
                    </View>
                  )}
                </View>
              </PressableScale>
              {/*
                REDESIGN (2026-10-07) — principal ponto da rodada: o
                "X" permanente virou um "•••" discreto (`scrim.control`,
                chip pequeno, sem círculo grande) que abre o mesmo
                `OptionSheet` usado em `PostCard.tsx`/episódio pra
                "Remover da lista" — sem confirmação extra (igual ao
                comportamento anterior do "X"), haptic/erro preservados
                em `handleRemove`.
              */}
              <Pressable
                hitSlop={8}
                style={styles.itemMenuButton}
                onPress={() => setActiveItemMenu(item)}
                accessibilityRole="button"
                accessibilityLabel={t("profile.moreOptions")}
              >
                <Feather name="more-horizontal" size={10} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </View>
          )}
        />
      )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  // POLISH (2026-10-07, rodada 2) — "3 títulos" + pill de co-dono na
  // mesma linha, `space-between`, logo abaixo do `ScreenHeader`.
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: -spacing.xs,
    paddingBottom: spacing.sm,
  },
  metaLeft: {
    flexShrink: 1,
  },
  countText: {
    fontSize: fontSize.xs,
  },
  // POLISH (2026-10-07, rodada 2 — "não quero uma pill âmbar
  // chamativa") — fundo neutro (era `tint.subtle`, âmbar 12%); o
  // âmbar sobra só no ícone `user-plus` do estado "convidar".
  coOwnerPill: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  coOwnerAvatar: { width: 20, height: 20, borderRadius: 10 },
  coOwnerAvatarInitials: { fontSize: fontSize.micro },
  coOwnerPillText: { fontSize: fontSize.xs, fontWeight: "500", color: colors.muted, flexShrink: 1 },
  invitePillText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.muted },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: POSTER_GRID_GAP,
  },
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
  // REDESIGN (2026-10-07) — era `<Glass>` (borda + blur + gradiente);
  // agora só pinta o fallback (`colors.surface`) atrás da imagem,
  // igual ao padrão de `ListCollectionCard.tsx` (mosaico de "Minhas
  // listas", mesma decisão de "pôster como protagonista").
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  posterImage: { width: "100%", height: "100%" },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // REDESIGN (2026-10-07) — substitui `removeButtonWrap`/`removeButton`
  // (círculo de 24×24 sempre visível). A pedido explícito ("não crie
  // um botão grande/círculo chamativo") — chip pequeno (`radius.sm`,
  // não `radius.full`).
  // POLISH (2026-10-07, rodada 2 — "ainda estão visualmente fortes,
  // especialmente 3 repetidos lado a lado") — menor ainda (18→15) e
  // fundo mais transparente que `scrim.control` (que é 75% opaco, bom
  // pra um botão sozinho sobre imagem, forte demais repetido 3×);
  // ícone também perde um pouco de opacidade. "Encontrado quando
  // procurado, não percebido antes das capas" — ainda com contraste
  // suficiente pra continuar utilizável (tamanho de toque real
  // continua 18×18 via `hitSlop`, só o visual encolheu).
  itemMenuButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 15,
    height: 15,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,14,20,0.4)",
  },
});
