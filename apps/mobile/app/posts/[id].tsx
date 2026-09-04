import { ScrollView, View, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { usePost } from "@/lib/usePost";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { PostCard } from "@/components/feed/PostCard";
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-102 — porta de `PostDetailView.tsx` do web: o mesmo
 * `PostCard`, só que com `detail` (não navega pra si mesmo) e os
 * comentários sempre abertos embaixo, rolando a tela pra baixo.
 */
export default function PostDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id);

  const { post, isLoading, isError, refetch } = usePost(postId);

  return (
    <Screen padded={false} bottomInset>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Post</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          {isLoading ? (
            <PostCardSkeleton count={1} />
          ) : isError ? (
            <PageError message={t("feed.errorLoadPost")} onRetry={() => refetch()} />
          ) : !post ? (
            <Text variant="muted">{t("feed.postNoLongerExists")}</Text>
          ) : (
            <PostCard post={post} detail />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
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
});
