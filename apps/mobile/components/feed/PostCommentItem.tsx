import { useState } from "react";
import { View, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { CommentNode } from "@/lib/postComments";
import { LikeButton } from "./LikeButton";
import { Text, Button, Glass } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-102/126/131 — porta de `PostCommentItem.tsx`. Correção
 * (TASK-131, a pedido): "Responder" tinha ficado como um atalho
 * inline (mudava o alvo do composer na mesma tela) — o web abre uma
 * tela própria (`/posts/[postId]/comment/[commentId]`), igual a
 * tocar num post abre a tela do post. Corrigido pra navegar de
 * verdade, batendo com o web.
 *
 * FASE 1 (paridade com comentário de Episódio, 2026-09-26 — "Faça o
 * comentário de Post seguir o padrão visual e comportamental já
 * aprovado para comentários de Episódio") — avatar de verdade,
 * hierarquia nome/data empilhada, escala tipográfica "Opção B",
 * divisor antes das ações, card `Glass` no comentário-raiz e
 * capacidade de editar (nunca existia aqui). NÃO trouxe pro Post o
 * que é específico do Episódio e não foi pedido: a bandeira/contador
 * de respostas (existe só porque a lista de Episódio usa `flatten`;
 * Post nunca teve esse conceito e não foi pedido criar um) nem
 * spoiler/anexar imagem (recursos do comentário de mídia, não do
 * comentário de Post) — evita inventar um terceiro padrão.
 */
export function PostCommentItem({
  comment,
  postId,
  depth,
  onDelete,
  onEdit,
  likeInfoByCommentId,
}: {
  comment: CommentNode;
  postId: string;
  depth: number;
  onDelete: (commentId: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  /** TASK-153 — curtidas de todos os comentários já buscadas em lote por quem chama, evita 1 busca por comentário. */
  likeInfoByCommentId?: Map<string, { count: number; hasLiked: boolean }>;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const isOwn = session?.user.id === comment.userId;
  const { t, locale } = useTranslation();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });

  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body ?? "");
  const [saving, setSaving] = useState(false);
  // FASE 2 (consistência visual sistêmica, Task 9 "ações e feedback",
  // 2026-09-26) — achado real: apagar comentário já tinha confirmação
  // + tratamento de erro, mas nada indicava que a exclusão estava em
  // andamento (diferente de editar, que já usa `Button loading={saving}`
  // acima). Sem isso, um toque duplo durante a espera da rede podia
  // disparar `onDelete` duas vezes.
  const [deleting, setDeleting] = useState(false);

  async function handleSaveEdit() {
    if (!editBody.trim()) return;
    setSaving(true);
    try {
      await onEdit(comment.id, editBody.trim());
      setEditing(false);
    } catch (error) {
      console.error("[PostCommentItem] Falha ao editar comentário", error);
      Alert.alert(t("social.errorEditComment"), error instanceof Error ? error.message : t("common.tryAgainShortly"));
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    Alert.alert(t("social.confirmDeleteCommentTitle"), t("social.confirmDeleteCommentMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("social.delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            await onDelete(comment.id);
          } catch (error) {
            console.error("[PostCommentItem] Falha ao apagar comentário", error);
            Alert.alert(t("social.errorDeleteComment"), error instanceof Error ? error.message : t("common.tryAgainShortly"));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }

  // Mesmo critério do `EpisodeCommentItem.tsx` (porte do web,
  // 2026-09-04): só o comentário-raiz (depth 0) vira card `Glass`;
  // respostas (depth > 0) continuam sem card próprio, só indentação.
  const Container = depth === 0 ? Glass : View;

  return (
    <Container style={depth === 0 ? styles.card : styles.nested}>
      {editing ? (
        <View>
          <TextInput value={editBody} onChangeText={setEditBody} multiline autoFocus style={styles.editInput} />
          <View style={styles.editButtons}>
            <Pressable onPress={() => setEditing(false)} style={styles.editCancelButton}>
              <Text variant="muted">{t("common.cancel")}</Text>
            </Pressable>
            <View style={styles.editSaveButton}>
              <Button onPress={handleSaveEdit} loading={saving} disabled={!editBody.trim()}>
                {t("common.save")}
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.headerRow}>
            <Pressable style={styles.authorTouch} onPress={() => router.push(`/u/${comment.authorUsername}`)}>
              <Avatar uri={comment.authorAvatarUrl} name={comment.authorName} style={styles.avatar} textStyle={styles.avatarInitials} />
              <View style={styles.metaCol}>
                <View style={styles.nameRow}>
                  <Text style={styles.authorName}>{comment.authorName}</Text>
                  <VerifiedBadge tier={comment.authorVerifiedTier} size={fontSize.md} />
                </View>
                <Text variant="muted" style={styles.date}>
                  {dateFormatter.format(new Date(comment.createdAt))}
                </Text>
              </View>
            </Pressable>
          </View>

          <Text style={styles.body}>{comment.body}</Text>

          {/* Mesmo divisor fino do `EpisodeCommentItem.tsx`, separando o texto das ações. */}
          <View style={styles.actionsDivider} />

          <View style={styles.actionsRow}>
            <LikeButton targetType="post_comment" targetId={comment.id} initial={likeInfoByCommentId?.get(comment.id)} />
            {depth < 2 && (
              <Pressable onPress={() => router.push(`/posts/${postId}/comment/${comment.id}`)}>
                <Text variant="muted" style={styles.actionLabel}>
                  {t("social.reply")}
                </Text>
              </Pressable>
            )}
            {isOwn && (
              <>
                <Pressable onPress={() => setEditing(true)} disabled={deleting}>
                  <Text variant="muted" style={styles.actionLabel}>
                    {t("common.edit")}
                  </Text>
                </Pressable>
                <Pressable onPress={handleDelete} disabled={deleting}>
                  <Text style={styles.deleteLabel}>{deleting ? t("common.deleting") : t("social.delete")}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {comment.children.length > 0 && (
        <View style={styles.childrenWrapper}>
          {comment.children.map((child) => (
            <PostCommentItem
              key={child.id}
              comment={child}
              postId={postId}
              depth={depth + 1}
              onDelete={onDelete}
              onEdit={onEdit}
              likeInfoByCommentId={likeInfoByCommentId}
            />
          ))}
        </View>
      )}
    </Container>
  );
}

// Mesmo valor do `EpisodeCommentItem.tsx` ("Opção B", 2026-09-25).
const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  // Mesmo raio do comentário de Episódio (`radius.lg`) — `Glass` não
  // define raio sozinho, então precisa ficar aqui.
  card: {
    borderRadius: radius.lg,
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
  },
  authorTouch: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    flexShrink: 1,
  },
  metaCol: {
    flexDirection: "column",
    gap: 1,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — tokens formalizados `fontSize.xs`/`fontSize.md` (eram literais 12/16, mesmos valores).
  avatarInitials: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.muted,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  authorName: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
    fontSize: fontSize.xsPlus,
  },
  body: {
    marginTop: 2,
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.md` (era literal 16, mesmo valor).
    fontSize: fontSize.md,
    color: colors.text,
  },
  actionsDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: spacing.xs,
    columnGap: spacing.md,
    marginTop: spacing.sm,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do usuário) — tokens formalizados `fontSize.smPlus` (eram literais 15, mesmo valor).
  actionLabel: {
    fontSize: fontSize.smPlus,
    fontWeight: "600",
  },
  deleteLabel: {
    fontSize: fontSize.smPlus,
    fontWeight: "600",
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
