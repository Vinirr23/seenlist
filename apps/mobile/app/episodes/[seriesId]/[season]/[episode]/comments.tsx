import { ScrollView, View, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { EpisodeCommentsSection } from "@/components/episode/EpisodeCommentsSection";
import { Screen, Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-122 (episódio) — porta de `CommentsPageView.tsx`: tela própria
 * (não mais embutida na tela de detalhes do episódio), igual ao web.
 */
export default function EpisodeCommentsScreen() {
  const router = useRouter();
  const { seriesId, season, episode } = useLocalSearchParams<{ seriesId: string; season: string; episode: string }>();
  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Comentários</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <EpisodeCommentsSection
          seriesId={seriesIdNum}
          target={{ mediaType: "series", mediaId: seriesIdNum, seasonNumber, episodeNumber }}
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
