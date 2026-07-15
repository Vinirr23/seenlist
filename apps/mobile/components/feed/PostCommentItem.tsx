import { View, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CommentNode } from "@/lib/postComments";
import { LikeButton } from "./LikeButton";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-102/126/131 — porta de `PostCommentItem.tsx`. Correção
 * (TASK-131, a pedido): "Responder" tinha ficado como um atalho
 * inline (mudava o alvo do composer na mesma tela) — o web abre uma
 * tela própria (`/posts/[postId]/comment/[commentId]`), igual a
 * tocar num post abre a tela do post. Corrigido pra navegar de
 * verdade, batendo com o web.
 */
export function PostCommentItem({
  comment,
  postId,
  depth,
  onDelete,
  likeInfoByCommentId,
}: {
  comment: CommentNode;
  postId: string;
  depth: number;
  onDelete: (commentId: string) => Promise<void>;
  /** TASK-153 — curtidas de todos os comentários já buscadas em lote por quem chama, evita 1 busca por comentário. */
  likeInfoByCommentId?: Map<string, { count: number; hasLiked: boolean }>;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const isOwn = session?.user.id === comment.userId;

  function handleDelete() {
    Alert.alert("Apagar este comentário?", "Não dá pra desfazer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await onDelete(comment.id);
          } catch (error) {
            console.error("[PostCommentItem] Falha ao apagar comentário", error);
            Alert.alert("Não foi possível apagar", error instanceof Error ? error.message : "Tente de novo em instantes.");
          }
        },
      },
    ]);
  }

  return (
    <View style={depth > 0 ? styles.nested : undefined}>
      <View style={styles.row}>
        <View style={styles.headerRow}>
          <Text style={styles.authorName}>{comment.authorName}</Text>
          <Text variant="muted" style={styles.date}>
            {dateFormatter.format(new Date(comment.createdAt))}
          </Text>
        </View>
        <Text style={styles.body}>{comment.body}</Text>
        <View style={styles.actionsRow}>
          <LikeButton targetType="post_comment" targetId={comment.id} initial={likeInfoByCommentId?.get(comment.id)} />
          {depth < 2 && (
            <Pressable onPress={() => router.push(`/posts/${postId}/comment/${comment.id}`)}>
              <Text variant="muted" style={styles.replyLabel}>
                Responder
              </Text>
            </Pressable>
          )}
          {isOwn && (
            <Pressable onPress={handleDelete}>
              <Text style={styles.deleteLabel}>Apagar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {comment.children.map((child) => (
        <PostCommentItem key={child.id} comment={child} postId={postId} depth={depth + 1} onDelete={onDelete} likeInfoByCommentId={likeInfoByCommentId} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nested: {
    marginLeft: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },
  row: {
    paddingVertical: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  authorName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    fontSize: 11,
  },
  body: {
    marginTop: 2,
    fontSize: 13,
    color: colors.text,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  replyLabel: {
    fontSize: 12,
  },
  deleteLabel: {
    fontSize: 12,
    color: colors.danger,
  },
});
