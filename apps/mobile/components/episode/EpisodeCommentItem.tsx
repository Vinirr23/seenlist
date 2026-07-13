import { useState } from "react";
import { View, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CommentNode } from "@/lib/social/mediaComments";
import { SpoilerGate } from "@/components/reviews/SpoilerGate";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/**
 * TASK-122/123/129 — porta de `CommentItem.tsx`. Correção (TASK-129,
 * a pedido): tinha ficado igual visualmente em todos os níveis (só
 * recuo) — no web, só o comentário de NÍVEL 0 vira um card (borda +
 * fundo + padding); as respostas (nível 1/2) ficam recuadas DENTRO
 * dessa mesma caixa, sem card próprio — não é uma tela separada, é
 * só um agrupamento visual mesmo.
 */
export function EpisodeCommentItem({
  comment,
  depth,
  autoHideSpoilers,
  onReply,
  onDelete,
  onEdit,
}: {
  comment: CommentNode;
  depth: number;
  autoHideSpoilers: boolean;
  onReply: (commentId: string, authorName: string) => void;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const isOwn = session?.user.id === comment.author.userId;
  const displayName = comment.author.displayName ?? comment.author.username;

  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSaveEdit() {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      await onEdit(comment.id, editBody.trim());
      setEditing(false);
    } catch (error) {
      console.error("[EpisodeCommentItem] Falha ao editar comentário", error);
      Alert.alert("Não foi possível editar", error instanceof Error ? error.message : "Tente de novo em instantes.");
    } finally {
      setSaving(false);
    }
  }

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
            console.error("[EpisodeCommentItem] Falha ao apagar comentário", error);
            Alert.alert("Não foi possível apagar", error instanceof Error ? error.message : "Tente de novo em instantes.");
          }
        },
      },
    ]);
  }

  return (
    <View style={depth === 0 ? styles.card : styles.nested}>
      {editing ? (
        <View>
          <TextInput value={editBody} onChangeText={setEditBody} multiline autoFocus style={styles.editInput} />
          <View style={styles.editButtons}>
            <Pressable onPress={() => setEditing(false)} style={styles.editCancelButton}>
              <Text variant="muted">Cancelar</Text>
            </Pressable>
            <View style={styles.editSaveButton}>
              <Button onPress={handleSaveEdit} loading={saving} disabled={!editBody.trim()}>
                Salvar
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.push(`/u/${comment.author.username}`)}>
              <Text style={styles.authorName}>{displayName}</Text>
            </Pressable>
            <Text variant="muted" style={styles.date}>
              {dateFormatter.format(new Date(comment.createdAt))}
            </Text>
          </View>

          <SpoilerGate hidden={comment.containsSpoiler || autoHideSpoilers}>
            {!!comment.body && <Text style={styles.body}>{comment.body}</Text>}
          </SpoilerGate>

          <View style={styles.actionsRow}>
            {depth < 2 && (
              <Pressable onPress={() => onReply(comment.id, displayName)}>
                <Text variant="muted" style={styles.actionLabel}>
                  Responder
                </Text>
              </Pressable>
            )}
            {isOwn && (
              <>
                <Pressable onPress={() => setEditing(true)}>
                  <Text variant="muted" style={styles.actionLabel}>
                    Editar
                  </Text>
                </Pressable>
                <Pressable onPress={handleDelete}>
                  <Text style={styles.deleteLabel}>Apagar</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {comment.children.length > 0 && (
        <View style={styles.childrenWrapper}>
          {comment.children.map((child) => (
            <EpisodeCommentItem
              key={child.id}
              comment={child}
              depth={depth + 1}
              autoHideSpoilers={autoHideSpoilers}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Só o comentário de nível 0 vira card — borda + fundo + padding, igual ao web. */
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  /** Respostas (nível 1+): sem card próprio, só recuo + linha vertical à esquerda — tudo dentro da mesma caixa do pai. */
  nested: {
    marginTop: spacing.sm,
  },
  childrenWrapper: {
    marginTop: spacing.sm,
    marginLeft: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    gap: spacing.sm,
  },
  row: {
    gap: 2,
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
  actionLabel: {
    fontSize: 12,
  },
  deleteLabel: {
    fontSize: 12,
    color: colors.danger,
  },
  editInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: "top",
  },
  editButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "flex-end",
    marginTop: spacing.xs,
  },
  editCancelButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  editSaveButton: {
    minWidth: 90,
  },
});
