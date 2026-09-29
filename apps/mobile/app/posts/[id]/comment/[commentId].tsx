import { useMemo, useState } from "react";
import { ScrollView, View, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { usePostComments } from "@/lib/usePost";
import { findCommentNode, type CommentNode } from "@/lib/postComments";
import { PostCommentItem } from "@/components/feed/PostCommentItem";
import { LikeButton } from "@/components/feed/LikeButton";
import { Screen, Text, Button, ScreenHeader } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/** Conta todas as respostas (em qualquer nível), igual ao helper de mesmo nome em `PostCommentItem.tsx`/`EpisodeCommentItem.tsx`. */
function countDescendants(node: CommentNode): number {
  let total = node.children.length;
  for (const child of node.children) total += countDescendants(child);
  return total;
}

/**
 * TASK-131 — porta de `PostCommentDetailView.tsx`: tela dedicada de
 * comentário, aberta ao tocar "Responder" num comentário (em vez do
 * campo inline que existia antes). Mostra o comentário-pai em
 * destaque no topo, as respostas que ele já tem logo abaixo, e um
 * composer que grava a resposta já com `parentCommentId` apontando
 * pra este comentário.
 *
 * FASE 1 (paridade com a tela equivalente de Episódio, 2026-09-26) —
 * reescrita completa pra bater com
 * `app/episodes/[seriesId]/[season]/[episode]/comment/[commentId].tsx`:
 * composer no topo dentro de um card `Glass` (era um `TextInput` solto
 * DEPOIS das respostas); comentário em destaque também vira `Glass`
 * (era `borderWidth`+`backgroundColor` sólidos); avatar de verdade,
 * nome/data empilhados, escala tipográfica "Opção B", divisor antes
 * das ações e capacidade de editar (nenhuma das duas existia aqui);
 * strings hardcoded em português traduzidas (item pendente da FASE 1,
 * ver `translations.ts`: `social.commentSingularTitle`,
 * `social.commentNoLongerExists`, `social.noRepliesYet`,
 * `social.replyPlaceholder` — a última é nova, não existia em
 * nenhuma das duas telas). NÃO trouxe spoiler/anexar imagem no
 * composer — recursos do comentário de mídia, não pedidos aqui.
 */
export default function PostCommentDetailScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { session } = useAuth();
  const dateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "short" });
  const { id: postId, commentId } = useLocalSearchParams<{ id: string; commentId: string }>();
  const { tree, isLoading, sending, submit, remove, edit } = usePostComments(String(postId));
  const [body, setBody] = useState("");
  const [editingTop, setEditingTop] = useState(false);
  const [editTopBody, setEditTopBody] = useState("");
  const [savingTop, setSavingTop] = useState(false);

  const comment = useMemo(() => findCommentNode(tree, String(commentId)), [tree, commentId]);
  const isOwn = session?.user.id === comment?.userId;
  const replyCount = comment ? countDescendants(comment) : 0;

  async function handleSubmit() {
    if (!body.trim()) return;
    const ok = await submit(body, String(commentId));
    if (ok) setBody("");
  }

  function handleDeleteTop() {
    if (!comment) return;
    Alert.alert(t("social.confirmDeleteCommentTitle"), t("social.confirmDeleteCommentMessage"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("social.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await remove(comment.id);
            router.back();
          } catch (error) {
            console.error("[PostCommentDetailScreen] Falha ao apagar comentário", error);
            Alert.alert(t("social.errorDeleteComment"), error instanceof Error ? error.message : t("common.tryAgainShortly"));
          }
        },
      },
    ]);
  }

  async function handleSaveEditTop() {
    if (!comment || !editTopBody.trim()) return;
    setSavingTop(true);
    try {
      await edit(comment.id, editTopBody.trim());
      setEditingTop(false);
    } catch (error) {
      console.error("[PostCommentDetailScreen] Falha ao editar comentário", error);
      Alert.alert(t("social.errorEditComment"), error instanceof Error ? error.message : t("common.tryAgainShortly"));
    } finally {
      setSavingTop(false);
    }
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("social.commentSingularTitle")} />

      {/*
        * A PEDIDO (2026-09-29, "responder um comentário, abre uma tela
        * com glass e etc... deixa igual o resto de feed") — tirado o
        * `GlassTargetProvider`+`AmbientGlow` (manchas de fundo) inteiro;
        * a tela agora é flat igual o resto do Feed já redesenhado.
        */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}>
        {isLoading ? (
          <AvatarRowSkeleton count={1} />
        ) : !comment ? (
          <Text variant="muted" style={styles.centerText}>
            {t("social.commentNoLongerExists")}
          </Text>
        ) : (
          <>
            {/*
              * A PEDIDO (2026-09-29, "tira o vidro, deixa igual o resto
              * do feed") — era `<Glass>`; virou `View` simples, mesmo
              * padrão do composer de `PostCommentsSection.tsx`.
              */}
            <View style={styles.composerArea}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder={t("social.replyPlaceholder")}
                placeholderTextColor={colors.muted}
                multiline
                style={styles.input}
              />
              <View style={styles.composerFooter}>
                <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={!body.trim() || sending}>
                  <Text style={styles.sendButtonText}>{t("common.send")}</Text>
                </Pressable>
              </View>
            </View>

            {/*
              * A PEDIDO (2026-09-29, "tira o vidro, deixa igual o resto
              * do feed") — era `<Glass>` (cartão de vidro, mesmo critério
              * do comentário-raiz de `PostCommentItem`/
              * `EpisodeCommentItem`); virou `View` simples, sem
              * fundo/borda arredondada.
              */}
            <View style={styles.commentCard}>
              {editingTop ? (
                <View>
                  <TextInput value={editTopBody} onChangeText={setEditTopBody} multiline autoFocus style={styles.editInput} />
                  <View style={styles.editButtons}>
                    <Pressable onPress={() => setEditingTop(false)} style={styles.editCancelButton}>
                      <Text variant="muted">{t("common.cancel")}</Text>
                    </Pressable>
                    <View style={styles.editSaveButton}>
                      <Button onPress={handleSaveEditTop} loading={savingTop} disabled={!editTopBody.trim()}>
                        {t("common.save")}
                      </Button>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  {/*
                    * CORREÇÃO (2026-09-29, reportado com print comparando
                    * com o Threads real — "horário/dia embaixo do nome,
                    * no Threads é do lado do nome") — nome e data agora
                    * ficam na mesma linha (dentro de `commentHeader`), em
                    * vez de empilhados numa coluna (`metaCol`).
                    */}
                  <Pressable style={styles.commentHeader} onPress={() => router.push(`/u/${comment.authorUsername}`)}>
                    <Avatar uri={comment.authorAvatarUrl} name={comment.authorName} style={styles.avatar} textStyle={styles.avatarInitials} />
                    <Text style={styles.authorName}>{comment.authorName}</Text>
                    <Text variant="muted" style={styles.date}>
                      {dateFormatter.format(new Date(comment.createdAt))}
                    </Text>
                  </Pressable>
                  <Text style={styles.body}>{comment.body}</Text>
                  {/* A PEDIDO (mockup 2026-09-25, "bem melhor, pode aplicar") — linha fina separando o texto das ações, igual à referência. */}
                  <View style={styles.actionsDivider} />
                  <View style={styles.ownActionsRow}>
                    <LikeButton targetType="post_comment" targetId={comment.id} />
                    <View style={styles.replyCountDisplay}>
                      <View style={styles.actionIconBox}>
                        <Feather name="message-circle" size={22} color={colors.muted} />
                      </View>
                      <Text variant="muted" style={styles.replyCountLabel}>
                        {replyCount}
                      </Text>
                    </View>
                    {isOwn && (
                      <>
                        <Pressable
                          onPress={() => {
                            setEditTopBody(comment.body ?? "");
                            setEditingTop(true);
                          }}
                        >
                          <Text variant="muted" style={styles.editLabel}>
                            {t("common.edit")}
                          </Text>
                        </Pressable>
                        <Pressable onPress={handleDeleteTop}>
                          <Text style={styles.deleteLabel}>{t("social.delete")}</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={styles.repliesArea}>
              {comment.children.length === 0 ? (
                <Text variant="muted" style={styles.centerText}>
                  {t("social.noRepliesYet")}
                </Text>
              ) : (
                comment.children.map((child) => (
                  <PostCommentItem key={child.id} comment={child} postId={String(postId)} depth={0} onDelete={remove} onEdit={edit} />
                ))
              )}
            </View>
          </>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Mesmo valor do `PostCommentItem.tsx`/`EpisodeCommentItem.tsx` ("Opção B", 2026-09-25).
const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  centerText: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  // A PEDIDO (2026-09-29, "tira o vidro, deixa como o resto do feed") —
  // sem fundo/borda arredondada (era `Glass`); linha fina embaixo
  // separando o comentário em destaque das respostas, mesma receita do
  // resto do Feed.
  commentCard: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // CORREÇÃO (2026-09-29, "horário do lado do nome, igual Threads") —
  // nome+data agora ficam juntos, na mesma linha do avatar (era
  // `alignItems: "flex-start"` + uma coluna `metaCol` empilhada ao
  // lado; sem essa coluna, "center" alinha tudo no meio do avatar).
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  authorName: {
    flexShrink: 1,
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xsPlus` (era literal 13, mesmo valor).
    // CORREÇÃO (2026-09-29, "horário do lado do nome") — agora mora
    // dentro de `commentHeader`; `flexShrink: 0` pra nunca ser
    // espremido (o nome cede espaço primeiro).
    flexShrink: 0,
    fontSize: fontSize.xsPlus,
  },
  body: {
    marginTop: spacing.xs,
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.md` (era literal 16, mesmo valor).
    fontSize: fontSize.md,
    color: colors.text,
  },
  actionsDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  ownActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: spacing.xs,
    columnGap: spacing.md,
    marginTop: spacing.sm,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26, decisão do usuário) — token formalizado `fontSize.smPlus` (era literal 15, mesmo valor).
  editLabel: {
    fontSize: fontSize.smPlus,
    fontWeight: "600",
  },
  replyCountDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  replyCountLabel: {
    fontSize: fontSize.smPlus,
  },
  actionIconBox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
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
  repliesArea: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  // A PEDIDO (2026-09-29, "tira o vidro, deixa como o resto do feed") —
  // sem fundo/borda arredondada (era `Glass`); o `input` abaixo ganhou
  // sua própria borda sólida, mesmo critério do composer de
  // `PostCommentsSection.tsx`.
  composerArea: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  input: {
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
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sendButtonText: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.background,
  },
});
