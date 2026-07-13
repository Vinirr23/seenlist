import { View, Pressable, StyleSheet } from "react-native";
import type { CommentNode } from "@/lib/postComments";
import { LikeButton } from "./LikeButton";
import { Text } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-102 (comentários) — porta de `PostCommentItem.tsx`. Uma
 * diferença deliberada do web: lá, "Responder" navega pra uma tela
 * própria (`/explore/posts/[id]/comment/[commentId]`); aqui, muda o
 * alvo do composer que já está na tela (`onReply`) — mesmo recurso
 * (responder gera um comentário-filho, mostrado recuado), sem
 * precisar de uma rota nova só pra isso.
 */
export function PostCommentItem({
  comment,
  depth,
  onReply,
}: {
  comment: CommentNode;
  depth: number;
  onReply: (commentId: string, authorName: string) => void;
}) {
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
          <LikeButton targetType="post_comment" targetId={comment.id} />
          {depth < 2 && (
            <Pressable onPress={() => onReply(comment.id, comment.authorName)}>
              <Text variant="muted" style={styles.replyLabel}>
                Responder
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {comment.children.map((child) => (
        <PostCommentItem key={child.id} comment={child} depth={depth + 1} onReply={onReply} />
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
});
