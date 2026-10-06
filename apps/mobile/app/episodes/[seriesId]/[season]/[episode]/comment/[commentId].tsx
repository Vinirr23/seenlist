import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  buildCommentTree,
  fetchMediaComments,
  findCommentNode,
  postMediaComment,
  type CommentNode,
  type MediaTarget,
} from "@/lib/social/mediaComments";
import { useEpisodeComments } from "@/lib/social/useEpisodeComments";
import { pickImageFromLibrary, uploadCommentImage } from "@/lib/imageUpload";
import { EpisodeCommentItem } from "@/components/episode/EpisodeCommentItem";
import { LikeButton } from "@/components/feed/LikeButton";
import { SpoilerGate } from "@/components/reviews/SpoilerGate";
import { Screen, Text, Button, ScreenHeader } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { AdaptiveImage } from "@/components/media/AdaptiveImage";
import { colors, radius, spacing, fontSize, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { useNow } from "@/lib/useNow";
import { formatRelativeTime } from "@/lib/relativeTime";

/** Conta todas as respostas (em qualquer nível), igual ao helper de mesmo nome em `EpisodeCommentItem.tsx`. */
function countDescendants(node: CommentNode): number {
  let total = node.children.length;
  for (const child of node.children) total += countDescendants(child);
  return total;
}

/**
 * TASK-132/133 — tela dedicada de comentário de episódio, a pedido,
 * diverge do web de propósito: "Responder" navega (TASK-132), e
 * ganhou avatar/curtir/anexar imagem (TASK-133), nenhum dos três
 * presentes no CommentItem do web.
 *
 * DESIGN IGUALADO AO DA TELA EQUIVALENTE DO FEED (2026-10-06, a
 * pedido — "deixa igual a tela de resposta de post no feed", depois
 * de ver um mockup com 3 opções e preferir nenhuma) — porte 1:1 de
 * `app/posts/[id]/comment/[commentId].tsx`: `ScreenHeader`
 * compartilhado (era um cabeçalho manual próprio); composer sem
 * cartão (era `colors.surface` + `radius.lg`, igual ao composer da
 * lista) — agora é só o `TextInput` com borda própria, igual ao
 * composer do Feed; comentário em destaque também sem cartão — vira
 * `paddingVertical` + linha fina embaixo (era `colors.surface` +
 * `radius.lg`); avatar+nome+data na MESMA LINHA via `Avatar`
 * compartilhado (era empilhado numa coluna, com avatar/iniciais
 * desenhados à mão); data relativa (`formatRelativeTime`, "2 d") em
 * vez de data absoluta ("06 de out."), mesmo padrão do Feed. Único
 * recurso que o Feed não tem aqui e esta tela mantém, por ser
 * funcionalidade própria de comentário de mídia (não visual): anexar
 * imagem/GIF e "contém spoiler" — ficam como linhas soltas, sem
 * cartão, mesma lógica "sem fundo" do resto da tela.
 */
export default function EpisodeCommentDetailScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { session } = useAuth();
  const now = useNow(30_000);
  const { seriesId, season, episode, commentId } = useLocalSearchParams<{
    seriesId: string;
    season: string;
    episode: string;
    commentId: string;
  }>();

  const seriesIdNum = Number(seriesId);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const target: MediaTarget = useMemo(
    () => ({ mediaType: "series", mediaId: seriesIdNum, seasonNumber, episodeNumber }),
    [seriesIdNum, seasonNumber, episodeNumber]
  );

  const { edit, remove } = useEpisodeComments(target);
  const espacoDoDock = useTabBarClearance();

  const [comment, setComment] = useState<ReturnType<typeof findCommentNode>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [markSpoiler, setMarkSpoiler] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [editingTop, setEditingTop] = useState(false);
  const [editTopBody, setEditTopBody] = useState("");
  const [savingTop, setSavingTop] = useState(false);

  function load() {
    setIsLoading(true);
    fetchMediaComments(target)
      .then((comments) => {
        const tree = buildCommentTree(comments);
        setComment(findCommentNode(tree, String(commentId)));
      })
      .catch((error) => console.error("[EpisodeCommentDetailScreen] Falha ao buscar comentário", error))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps -- proposital: depende só dos campos primitivos de `target`, não do objeto inteiro, pra não reexecutar toda vez que o chamador recriar `target` sem memoizar (mesmo padrão de `useReviews.ts`/`useReviewAggregate.ts`).
  useEffect(load, [target.mediaId, target.seasonNumber, target.episodeNumber, commentId]);

  async function handlePickImage() {
    setUploadError(null);
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setImageUri(picked.uri);
    setImageMimeType(picked.mimeType);
  }

  async function handleSubmit() {
    if (!body.trim() && !imageUri) return;
    setUploadError(null);

    let uploadedImageUrl: string | null = null;
    if (imageUri && imageMimeType) {
      setUploadingImage(true);
      const result = await uploadCommentImage(imageUri, imageMimeType);
      setUploadingImage(false);
      if (result.error || !result.url) {
        setUploadError(result.error ?? t("error.uploadImageFailed"));
        return;
      }
      uploadedImageUrl = result.url;
    }

    setSending(true);
    try {
      await postMediaComment(target, body, markSpoiler, String(commentId), uploadedImageUrl);
      setBody("");
      setMarkSpoiler(false);
      setImageUri(null);
      setImageMimeType(null);
      load();
    } catch (error) {
      console.error("[EpisodeCommentDetailScreen] Falha ao responder", error);
    } finally {
      setSending(false);
    }
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
            console.error("[EpisodeCommentDetailScreen] Falha ao apagar comentário", error);
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
      load();
    } catch (error) {
      console.error("[EpisodeCommentDetailScreen] Falha ao editar comentário", error);
      Alert.alert(t("social.errorEditComment"), error instanceof Error ? error.message : t("common.tryAgainShortly"));
    } finally {
      setSavingTop(false);
    }
  }

  async function handleDelete(id: string) {
    await remove(id);
    load();
  }

  async function handleEdit(id: string, newBody: string) {
    await edit(id, newBody);
    load();
  }

  const commentsBaseHref = `/episodes/${seriesIdNum}/${seasonNumber}/${episodeNumber}`;
  const isOwn = session?.user.id === comment?.author.userId;
  const displayName = comment ? comment.author.displayName ?? comment.author.username : "";
  const busy = sending || uploadingImage;
  const replyCount = comment ? countDescendants(comment) : 0;

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("social.commentSingularTitle")} />

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
              <View style={styles.composerArea}>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder={t("social.replyPlaceholder")}
                  placeholderTextColor={colors.muted}
                  multiline
                  style={styles.input}
                />

                {imageUri ? (
                  <View style={styles.imagePreviewWrapper}>
                    <ExpoImage source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" autoplay />
                    <Pressable
                      hitSlop={8}
                      style={styles.removeImageButton}
                      onPress={() => {
                        setImageUri(null);
                        setImageMimeType(null);
                      }}
                    >
                      <Feather name="x" size={14} color={colors.text} />
                    </Pressable>
                  </View>
                ) : null}

                {!!uploadError && <Text variant="error">{uploadError}</Text>}

                <View style={styles.composerExtrasRow}>
                  <Pressable style={styles.attachButton} onPress={handlePickImage} disabled={busy}>
                    <Feather name="image" size={14} color={colors.muted} />
                    <Text variant="muted" style={styles.attachButtonText}>
                      {imageUri ? t("feed.changeImage") : t("social.attachImage")}
                    </Text>
                  </Pressable>

                  <Pressable style={styles.spoilerToggle} onPress={() => setMarkSpoiler((v) => !v)}>
                    <Feather name={markSpoiler ? "check-square" : "square"} size={16} color={markSpoiler ? colors.primary : colors.muted} />
                    <Text variant="muted" style={styles.spoilerLabel}>
                      {t("social.containsSpoilerLabel")}
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.composerFooter}>
                  <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={(!body.trim() && !imageUri) || busy}>
                    <Text style={styles.sendButtonText}>{uploadingImage ? t("common.uploading") : t("common.send")}</Text>
                  </Pressable>
                </View>
              </View>

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
                    <Pressable style={styles.commentHeader} onPress={() => router.push(`/u/${comment.author.username}`)}>
                      <Avatar uri={comment.author.avatarUrl} name={displayName} style={styles.avatar} textStyle={styles.avatarInitials} />
                      <Text style={styles.authorName}>{displayName}</Text>
                      <Text variant="muted" style={styles.date}>
                        {formatRelativeTime(comment.createdAt, now, locale, t("feed.justNow"))}
                      </Text>
                    </Pressable>
                    <SpoilerGate hidden={comment.containsSpoiler}>
                      <View>
                        {!!comment.body && <Text style={styles.body}>{comment.body}</Text>}
                        {!!comment.imageUrl && <AdaptiveImage uri={comment.imageUrl} maxHeight={320} />}
                      </View>
                    </SpoilerGate>
                    <View style={styles.actionsDivider} />
                    <View style={styles.ownActionsRow}>
                      <LikeButton targetType="comment" targetId={comment.id} />
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
                    <EpisodeCommentItem
                      key={child.id}
                      comment={child}
                      depth={0}
                      commentsBaseHref={commentsBaseHref}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                    />
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

// Mesmo valor do `EpisodeCommentItem.tsx`/tela equivalente do Feed ("Opção B", 2026-09-25).
const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  centerText: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  // IGUALADO AO FEED (2026-10-06) — sem fundo/raio (era `colors.surface`
  // + `radius.lg`); linha fina embaixo separando o comentário em
  // destaque das respostas, mesma receita da tela equivalente do Feed.
  commentCard: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  // IGUALADO AO FEED (2026-10-06) — nome+data agora ficam na MESMA
  // LINHA do avatar (era `alignItems: "flex-start"` + uma coluna
  // `metaCol` empilhada ao lado).
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
    flexShrink: 0,
    fontSize: fontSize.xsPlus,
  },
  body: {
    marginTop: spacing.xs,
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
  // IGUALADO AO FEED (2026-10-06) — sem fundo/raio (era `colors.surface`
  // + `radius.lg`); o `input` abaixo ganha sua própria borda sólida,
  // mesmo critério do composer da tela equivalente do Feed.
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
  imagePreviewWrapper: {
    alignSelf: "flex-start",
    position: "relative",
  },
  imagePreview: {
    width: 140,
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeImageButton: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: scrim.control,
    alignItems: "center",
    justifyContent: "center",
  },
  // ÚNICO RECURSO QUE O FEED NÃO TEM AQUI (anexar imagem/"contém
  // spoiler" — funcionalidade própria de comentário de mídia, ver
  // comentário grande no topo do arquivo) — linha solta, sem cartão,
  // mesma lógica "sem fundo" do resto da tela.
  composerExtrasRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  attachButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  attachButtonText: {
    fontSize: fontSize.xs,
  },
  spoilerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spoilerLabel: {
    fontSize: fontSize.xs,
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
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.background,
  },
});
