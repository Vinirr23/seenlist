import { useEffect, useState } from "react";
import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { DiscoverItem } from "@/lib/discover";
import { fetchLibraryStatusesFor } from "@/lib/discover";
import { tmdbImageUrl } from "@/lib/library";
import { AddToLibraryButton } from "./AddToLibraryButton";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize, elevation } from "@/lib/theme";

const CARD_WIDTH = 112;

export function DiscoverCarousel({
  title,
  items,
  isLoading,
}: {
  title: string;
  items: DiscoverItem[];
  isLoading: boolean;
}) {
  /**
   * TASK-152 — busca o status de TODOS os itens visíveis de uma vez
   * (2 consultas no total, não uma por pôster) assim que a lista
   * chega — cada `AddToLibraryButton` já nasce sabendo se precisa
   * mostrar "+" ou "check", sem atraso individual.
   */
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [statusesLoaded, setStatusesLoaded] = useState(false);

  useEffect(() => {
    if (items.length === 0) return;
    fetchLibraryStatusesFor(items.map((item) => ({ mediaType: item.mediaType, id: item.id })))
      .then((result) => {
        setStatuses(result);
        setStatusesLoaded(true);
      })
      .catch((error) => console.error("[DiscoverCarousel] Falha ao buscar status em lote", error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i) => `${i.mediaType}-${i.id}`).join(",")]);

  /**
   * CORREÇÃO (a pedido, mesmo achado já corrigido no Explorar do web
   * — "por que fica aparecendo coisa que já está marcada?") —
   * reaproveita o MESMO lote de status já buscado pra mostrar o selo
   * de "+"/"check" (não dispara consulta nova): qualquer item que já
   * tenha status na Biblioteca some da lista de descoberta.
   */
  const visibleItems = statusesLoaded ? items.filter((item) => !statuses.has(`${item.mediaType}-${item.id}`)) : items;

  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={styles.title}>
        {title}
      </Text>

      {isLoading ? (
        <View style={styles.row}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {visibleItems.map((item) => (
            <DiscoverCard key={`${item.mediaType}-${item.id}`} item={item} status={statuses.get(`${item.mediaType}-${item.id}`) ?? null} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function DiscoverCard({ item, status }: { item: DiscoverItem; status: string | null }) {
  const router = useRouter();
  const posterUrl = tmdbImageUrl(item.posterPath, "w342");

  function handlePress() {
    if (item.mediaType === "series") {
      router.push(`/series/${item.id}`);
      return;
    }
    router.push(`/movies/${item.id}`);
  }

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <View style={styles.posterWrapper}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={styles.posterFallback}>
            <Feather name="film" size={20} color={colors.muted} />
          </View>
        )}
        <AddToLibraryButton mediaType={item.mediaType} mediaId={item.id} initialStatus={status} />
      </View>
      <Text numberOfLines={1} style={styles.cardTitle}>
        {item.title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  card: {
    // CORREÇÃO (auditoria de consistência) — mesma elevação do
    // pôster de `PosterGrid.tsx`: os dois são "pôster de mídia numa
    // lista", não faz sentido um ter profundidade e o outro não.
    // Sombra vai no wrapper de FORA (o de dentro tem `overflow:
    // hidden`, que cortaria a sombra).
    ...elevation.low,
    width: CARD_WIDTH,
    borderRadius: radius.md,
  },
  posterWrapper: {
    position: "relative",
    width: CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonCard: {
    width: CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  cardTitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.text,
  },
});
