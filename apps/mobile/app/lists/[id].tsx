import { useEffect, useState, useCallback } from "react";
import { View, Pressable, Alert, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyLists, fetchListItems, removeFromList, deleteList, type UserList, type ListItem } from "@/lib/lists";
import { usePosterCardWidth, POSTER_GRID_GAP } from "@/components/media/PosterGrid";
import { Screen, Text, Skeleton } from "@/components/ui";
import { colors, radius, spacing, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

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
          contentContainerStyle={styles.content}
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
                <View style={styles.poster}>
                  {item.posterPath && (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w342${item.posterPath}` }} style={styles.posterImage} />
                  )}
                </View>
              </Pressable>
              <Pressable hitSlop={8} style={styles.removeButton} onPress={() => handleRemove(item.id)}>
                <Feather name="x" size={12} color="#fff" />
              </Pressable>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
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
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  posterImage: { width: "100%", height: "100%" },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: scrim.overImage,
    borderRadius: 999,
    padding: 4,
  },
});
