import { useState } from "react";
import { View, Image, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CommentNode } from "@/lib/social/mediaComments";
import { SpoilerGate } from "@/components/reviews/SpoilerGate";
import { LikeButton } from "@/components/feed/LikeButton";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function initials(name: string): string {
  return name
    .split(" ")
    .filter((w) => w.length > 1)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * TASK-122/123/129/132/133 — porta de `CommentItem.tsx`, com
 * divergências do web PEDIDAS EXPLICITAMENTE: "Responder" navega
 * (TASK-132); avatar de verdade, curtir com contagem e anexar
 * imagem/GIF (TASK-133) — o web não tem nenhuma das três aqui (só
 * nome em texto, sem curtir, sem imagem no comentário de mídia,
 * mesmo a coluna `image_url` existindo — nunca foi usada no
 * CommentItem do web, só no comentário de Feed).
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
            <Pressable style={styles.authorRow} onPress={() => router.push(`/u/${comment.author.username}`)}>
              <View style={styles.avatar}>
                {comment.author.avatarUrl ? (
                  <Image source={{ uri: comment.author.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{initials(displayName)}</Text>
                )}
              </View>
              <Text style={styles.authorName}>{displayName}</Text>
            </Pressable>
            <Text variant="muted" style={styles.date}>
              {dateFormatter.format(new Date(comment.createdAt))}
            </Text>
          </View>

          <SpoilerGate hidden={comment.containsSpoiler || autoHideSpoilers}>
            <View>
              {!!comment.body && <Text style={styles.body}>{comment.body}</Text>}
              {!!comment.imageUrl && <Image source={{ uri: comment.imageUrl }} style={styles.commentImage} resizeMode="cover" />}
            </View>
          </SpoilerGate>

          <View style={styles.actionsRow}>
            <LikeButton targetType="comment" targetId={comment.id} />
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

const AVATAR_SIZE = 28;

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
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexShrink: 1,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
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
  commentImage: {
    marginTop: spacing.sm,
    width: "100%",
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.background,
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
