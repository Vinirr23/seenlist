import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePostComments } from "@/lib/usePost";
import { PostCommentItem } from "./PostCommentItem";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export function PostCommentsSection({ postId }: { postId: string }) {
  const { tree, isLoading, sending, submit } = usePostComments(postId);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);

  async function handleSubmit() {
    if (!body.trim()) return;
    const ok = await submit(body, replyTo?.id ?? null);
    if (ok) {
      setBody("");
      setReplyTo(null);
    }
  }

  return (
    <View style={styles.wrapper}>
      {isLoading ? (
        <Text variant="muted" style={styles.centerText}>
          Carregando comentários...
        </Text>
      ) : tree.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          Nenhum comentário ainda.
        </Text>
      ) : (
        <View>
          {tree.map((node) => (
            <PostCommentItem key={node.id} comment={node} depth={0} onReply={(id, authorName) => setReplyTo({ id, authorName })} />
          ))}
        </View>
      )}

      <View style={styles.composerArea}>
        {!!replyTo && (
          <View style={styles.replyingRow}>
            <Text variant="muted" style={styles.replyingText}>
              Respondendo a {replyTo.authorName}
            </Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Feather name="x" size={14} color={colors.muted} />
            </Pressable>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Escreva um comentário..."
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={!body.trim() || sending}>
            <Text style={styles.sendButtonText}>Enviar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
  },
  centerText: {
    paddingVertical: spacing.sm,
  },
  composerArea: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  replyingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  replyingText: {
    fontSize: 12,
  },
  inputRow: {
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
