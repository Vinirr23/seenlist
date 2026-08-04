import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ReviewsFullView } from "@/components/reviews/ReviewsFullView";
import { Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

/**
 * A PEDIDO (implementar tudo igual ao web) — tela própria
 * "Avaliações", igual `CommentsPageView.tsx`/`ReviewTextSection.tsx`
 * do web (`/series/[id]/comments`, que hoje só mostra review em
 * texto). Título/pôster chegam via parâmetro de rota (mandados por
 * `ReviewsSection.tsx` ao navegar) — evita buscar os detalhes da
 * série de novo só pra isso.
 */
export default function SeriesReviewsScreen() {
  const router = useRouter();
  const { id, title, posterPath } = useLocalSearchParams<{ id: string; title: string; posterPath: string }>();
  const numericId = Number(id);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Avaliações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ReviewsFullView
          target={{ mediaType: "series", mediaId: numericId }}
          media={{ title: title ?? "", posterPath: posterPath || null }}
        />
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
});
