import { useEffect, useState, useCallback } from "react";
import { ScrollView, View, Image, Pressable, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyLists, fetchListItems, removeFromList, deleteList, type UserList, type ListItem } from "@/lib/lists";
import { Screen, Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/** TASK-172 — porta de `ListDetailView.tsx` do web. */
export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [list, setList] = useState<UserList | null>(null);
  const [items, setItems] = useState<ListItem[] | null>(null);

  const reload = useCallback(() => {
    fetchMyLists().then((lists) => setList(lists.find((l) => l.id === id) ?? null));
    fetchListItems(id).then(setItems);
  }, [id]);

  useEffect(reload, [reload]);
  useFocusEffect(reload);

  function handleRemove(itemId: string) {
    removeFromList(itemId).then(reload);
  }

  function handleDeleteList() {
    Alert.alert("Apagar essa lista?", "Os itens dentro dela somem junto (sua biblioteca não é afetada).", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
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
          {list?.name ?? "Lista"}
        </Text>
        <Pressable onPress={handleDeleteList} hitSlop={8}>
          <Feather name="trash-2" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {items === null && <Text variant="muted">Carregando...</Text>}

        {items && items.length === 0 && (
          <Text variant="muted" style={styles.centerText}>
            Essa lista ainda não tem nada. Adicione pelo menu &quot;...&quot; na tela de uma série ou filme.
          </Text>
        )}

        {items && items.length > 0 && (
          <View style={styles.grid}>
            {items.map((item) => (
              <View key={item.id} style={styles.posterWrapper}>
                <Pressable
                  onPress={() => router.push(item.mediaType === "movie" ? `/movies/${item.mediaId}` : `/series/${item.mediaId}`)}
                >
                  <View style={styles.poster}>
                    {item.posterPath && (
                      <Image source={{ uri: `https://image.tmdb.org/t/p/w342${item.posterPath}` }} style={styles.posterImage} />
                    )}
                  </View>
                </Pressable>
                <Pressable style={styles.removeButton} onPress={() => handleRemove(item.id)}>
                  <Feather name="x" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
    gap: spacing.sm,
  },
  posterWrapper: {
    width: "31%",
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
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 999,
    padding: 4,
  },
});
