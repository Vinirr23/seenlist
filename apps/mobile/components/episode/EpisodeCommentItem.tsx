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
 * TASK-122/123/129/132 — porta de `CommentItem.tsx`, com uma
 * divergência do web PEDIDA EXPLICITAMENTE (TASK-132): no próprio
 * web, "Responder" aqui é um campo embutido (sem navegar) — só o
 * Feed navega pra tela própria. A pedido, esta versão navega
 * também, ficando igual ao Feed nos dois lugares. Só o comentário de
 * nível 0 vira card (borda + fundo); as respostas ficam recuadas
 * dentro da mesma caixa.
 */
export function EpisodeCommentItem({
  comment,
  depth,
  autoHideSpoilers,
  commentsBaseHref,
  onDelete,
  onEdit,
}: {
  comment: CommentNode;
  depth: number;
  autoHideSpoilers: boolean;
  /** Caminho da tela de comentários deste episódio, ex.: `/episodes/1399/1/1` — usado pra montar o link de "Responder" (`${commentsBaseHref}/comment/${comment.id}`). */
  commentsBaseHref: string;
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
              <Pressable onPress={() => router.push(`${commentsBaseHref}/comment/${comment.id}`)}>
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
              commentsBaseHref={commentsBaseHref}
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
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
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
