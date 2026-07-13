import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { usePostComments } from "@/lib/usePost";
import { PostCommentItem } from "./PostCommentItem";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-102/131 — porta de `PostCommentsSection.tsx`. Correção
 * (TASK-131): não muda mais o alvo do composer pra responder — só
 * comenta na raiz mesmo; responder a um comentário específico agora
 * abre a tela própria (ver `PostCommentItem.tsx`).
 */
export function PostCommentsSection({ postId }: { postId: string }) {
  const { tree, isLoading, sending, submit, remove } = usePostComments(postId);
  const [body, setBody] = useState("");

  async function handleSubmit() {
    if (!body.trim()) return;
    const ok = await submit(body, null);
    if (ok) setBody("");
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
            <PostCommentItem key={node.id} comment={node} postId={postId} depth={0} onDelete={remove} />
          ))}
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
