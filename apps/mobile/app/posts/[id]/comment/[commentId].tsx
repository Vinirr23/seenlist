import { useMemo, useState } from "react";
import { ScrollView, View, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { usePostComments } from "@/lib/usePost";
import { findCommentNode } from "@/lib/postComments";
import { PostCommentItem } from "@/components/feed/PostCommentItem";
import { LikeButton } from "@/components/feed/LikeButton";
import { Screen, Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-131 — porta de `PostCommentDetailView.tsx`: tela dedicada de
 * comentário, aberta ao tocar "Responder" num comentário (em vez do
 * campo inline que existia antes). Mostra o comentário-pai em
 * destaque no topo, as respostas que ele já tem logo abaixo, e um
 * composer fixo que grava a resposta já com `parentCommentId`
 * apontando pra este comentário.
 */
export default function PostCommentDetailScreen() {
  const router = useRouter();
  const { id: postId, commentId } = useLocalSearchParams<{ id: string; commentId: string }>();
  const { tree, isLoading, sending, submit, remove } = usePostComments(String(postId));
  const [body, setBody] = useState("");

  const comment = useMemo(() => findCommentNode(tree, String(commentId)), [tree, commentId]);

  async function handleSubmit() {
    if (!body.trim()) return;
    const ok = await submit(body, String(commentId));
    if (ok) setBody("");
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Comentário</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <AvatarRowSkeleton count={1} />
        ) : !comment ? (
          <Text variant="muted" style={styles.centerText}>
            Este comentário não existe mais.
          </Text>
        ) : (
          <>
            <View style={styles.commentCard}>
              <View style={styles.commentHeader}>
                <Text style={styles.authorName}>{comment.authorName}</Text>
                <Text variant="muted" style={styles.date}>
                  {dateFormatter.format(new Date(comment.createdAt))}
                </Text>
              </View>
              <Text style={styles.body}>{comment.body}</Text>
              <View style={styles.likeRow}>
                <LikeButton targetType="post_comment" targetId={comment.id} />
              </View>
            </View>

            <View style={styles.repliesArea}>
              {comment.children.length === 0 ? (
                <Text variant="muted" style={styles.centerText}>
                  Nenhuma resposta ainda.
                </Text>
              ) : (
                comment.children.map((child) => (
                  <PostCommentItem key={child.id} comment={child} postId={String(postId)} depth={0} onDelete={remove} />
                ))
              )}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Escreva uma resposta..."
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={!body.trim() || sending}>
                <Text style={styles.sendButtonText}>Enviar</Text>
              </Pressable>
            </View>
          </>
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
    paddingVertical: spacing.md,
  },
  commentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorName: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    fontSize: 11,
  },
  body: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  likeRow: {
    marginTop: spacing.sm,
  },
  repliesArea: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  inputRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm - 2,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  sendButton: {
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sendButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.background,
  },
});
