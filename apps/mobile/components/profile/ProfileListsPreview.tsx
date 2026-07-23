import { useEffect, useState } from "react";
import { View, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchMyListsWithPreview, type ListWithPreview } from "@/lib/lists";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const CARD_SIZE = 112;

/**
 * Porta de `ProfileListsPreview.tsx` do web — "Minhas listas" ganha o
 * efeito "baralho" (pôsteres empilhados/levemente rotacionados) em
 * vez de uma linha só com contador. Mesma regra: índice 0 é o item
 * mais recente (a consulta já vem ordenada assim), fica na frente
 * sem rotação; os de trás alternam o lado, tipo um baralho de
 * verdade.
 */
export function ProfileListsPreview() {
  const router = useRouter();
  const [lists, setLists] = useState<ListWithPreview[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchMyListsWithPreview()
      .then((data) => {
        if (!cancelled) setLists(data);
      })
      .catch((error) => {
        console.error("[ProfileListsPreview] Falha ao buscar listas", error);
        if (!cancelled) setLists([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Feather name="check-square" size={16} color={colors.primary} />
        <Text style={styles.sectionTitleText}>Minhas listas</Text>
      </View>

      {isLoading ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeleton, { width: CARD_SIZE, height: CARD_SIZE }]} />
          ))}
        </ScrollView>
      ) : !lists || lists.length === 0 ? (
        <Pressable style={styles.emptyCard} onPress={() => router.push("/lists")}>
          <Feather name="plus" size={22} color={colors.muted} />
          <Text style={styles.emptyText}>Criar sua primeira lista</Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {lists.map((list) => (
            <Pressable key={list.id} style={styles.card} onPress={() => router.push(`/lists/${list.id}`)}>
              <View style={styles.deck}>
                {list.previewPosters.length === 0 ? (
                  <View style={styles.deckEmpty}>
                    <Feather name="check-square" size={22} color={colors.muted} style={{ opacity: 0.4 }} />
                  </View>
                ) : (
                  list.previewPosters.slice(0, 4).map((posterPath, index, arr) => {
                    const posterUrl = tmdbImageUrl(posterPath, "w185");
                    const zIndex = arr.length - index;
                    const rotation = index === 0 ? 0 : (index % 2 === 0 ? 1 : -1) * index * 4;
                    const translateY = index === 0 ? 0 : index * -3;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.deckPoster,
                          { zIndex, transform: [{ translateY }, { rotate: `${rotation}deg` }] },
                        ]}
                      >
                        {posterUrl && <Image source={{ uri: posterUrl }} style={styles.deckPosterImage} resizeMode="cover" />}
                      </View>
                    );
                  })
                )}
              </View>
              <Text numberOfLines={1} style={styles.listName}>
                {list.name}
              </Text>
              <Text variant="muted" style={styles.listCount}>
                {list.itemCount} {list.itemCount === 1 ? "item" : "itens"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitleText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    gap: spacing.sm,
  },
  skeleton: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  card: {
    width: CARD_SIZE,
  },
  deck: {
    width: CARD_SIZE,
    height: CARD_SIZE,
  },
  deckEmpty: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  deckPoster: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  deckPosterImage: {
    width: "100%",
    height: "100%",
  },
  listName: {
    marginTop: 6,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  listCount: {
    fontSize: 11,
  },
});
