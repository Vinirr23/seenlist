import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ReviewsFullView } from "@/components/reviews/ReviewsFullView";
import { Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/** A PEDIDO (implementar tudo igual ao web) — mesma tela de `app/series/[id]/reviews.tsx`, pro filme. */
export default function MovieReviewsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id, title, posterPath } = useLocalSearchParams<{ id: string; title: string; posterPath: string }>();
  const numericId = Number(id);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("social.reviews")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ReviewsFullView
          target={{ mediaType: "movie", mediaId: numericId }}
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
