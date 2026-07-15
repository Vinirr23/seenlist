import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { Screen, Text } from "@/components/ui";
import { PostCardSkeleton } from "@/components/media/PostCardSkeleton";
import { usePosts } from "@/lib/usePosts";
import { PostCard } from "@/components/feed/PostCard";
import { CreatePostButton } from "@/components/feed/CreatePostButton";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-095 — primeira versão do Feed nativo: lista de posts reais do
 * Supabase, curtida de verdade, contagem de comentários real. Tocar
 * num post mostra "em breve" (a tela de post com comentários abertos
 * ainda não existe). Publicar só aceita texto por enquanto.
 */
export default function FeedScreen() {
  const { posts, isLoading, isError, refreshing, refetch } = usePosts();

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {isError ? (
          <Text variant="muted" style={styles.centerText}>
            Não foi possível carregar o Feed agora. Tente de novo em instantes.
          </Text>
        ) : isLoading ? (
          <PostCardSkeleton />
        ) : !posts || posts.length === 0 ? (
          <Text variant="muted" style={styles.centerText}>
            Ninguém publicou nada ainda. Seja o primeiro — toque no botão + aqui embaixo.
          </Text>
        ) : (
          <View style={styles.list}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onDeleted={refetch} />
            ))}
          </View>
        )}
      </ScrollView>

      <CreatePostButton onCreated={refetch} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  list: {
    gap: spacing.md,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
