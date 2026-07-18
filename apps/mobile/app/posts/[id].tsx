import { ScrollView, View, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { usePost } from "@/lib/usePost";
import { Screen, Text } from "@/components/ui";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { PostCard } from "@/components/feed/PostCard";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-102 — porta de `PostDetailView.tsx` do web: o mesmo
 * `PostCard`, só que com `detail` (não navega pra si mesmo) e os
 * comentários sempre abertos embaixo, rolando a tela pra baixo.
 */
export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = String(id);

  const { post, isLoading, isError } = usePost(postId);

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
            <Text variant="muted">Não foi possível carregar este post.</Text>
          ) : !post ? (
            <Text variant="muted">Este post não existe mais.</Text>
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
