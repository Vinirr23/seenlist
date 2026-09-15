import { useEffect, useState, useCallback } from "react";
import { View, Pressable, Alert, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyLists, fetchListItems, removeFromList, deleteList, type UserList, type ListItem } from "@/lib/lists";
import { usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { Screen, Text, Skeleton, GlassTargetProvider, Glass, AmbientGlow } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing } from "@/lib/theme";
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
  const cardWidth = usePosterCardWidth();

  const reload = useCallback(() => {
    fetchMyLists().then((lists) => setList(lists.find((l) => l.id === id) ?? null));
    fetchListItems(id, locale).then(setItems);
  }, [id, locale]);

  useEffect(reload, [reload]);
  useFocusEffect(reload);

  function handleRemove(itemId: string) {
    removeFromList(itemId).then(reload);
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

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle" style={{ flex: 1 }} numberOfLines={1}>
          {list?.name ?? t("profile.listFallbackName")}
        </Text>
        <Pressable onPress={handleDeleteList} hitSlop={8}>
          <Feather name="trash-2" size={20} color={colors.muted} />
        </Pressable>
      </View>

      {/* PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas das sub-telas (ver `lib/glowBlobs.ts`). */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      {items === null ? (
        <View style={[styles.content, styles.grid]}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ width: cardWidth }}>
              <Skeleton width="100%" height={160} borderRadius={radius.md} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={
            <Text variant="muted" style={styles.centerText}>
              {t("profile.emptyListMessage")}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={{ width: cardWidth }}>
              <Pressable
                onPress={() => router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`)}
              >
                {/* PORTE DO WEB (2026-09-04) — o pôster vira `<Glass>` (web, `ListDetailView.tsx`: `rounded-lg border border-white/10 backdrop-blur-[14px]`). */}
                <Glass style={styles.poster}>
                  {item.posterPath && (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w342${item.posterPath}` }} style={styles.posterImage} />
                  )}
                </Glass>
              </Pressable>
              {/* PORTE DO WEB (2026-09-04) — o "x" vira o mesmo círculo de vidro flutuante sobre a imagem do web (`GLASS_ICON_BTN` mini), no lugar do `scrim` sólido. */}
              <Pressable hitSlop={8} style={styles.removeButtonWrap} onPress={() => handleRemove(item.id)}>
                <Glass style={styles.removeButton}>
                  <Feather name="x" size={12} color="#fff" />
                </Glass>
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.lg,
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
  // CORREÇÃO (2026-09-04, "vidro que falta") — `backgroundColor` sólido
  // saiu (vira `<Glass>`, que já desenha borda + blur + gradiente);
  // `overflow: "hidden"` também não precisa mais (o `Glass` já tem).
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
  },
  posterImage: { width: "100%", height: "100%" },
  removeButtonWrap: {
    position: "absolute",
    top: 4,
    right: 4,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
