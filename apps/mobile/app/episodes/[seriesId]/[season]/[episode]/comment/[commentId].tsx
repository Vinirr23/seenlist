import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, Image, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCommentTree, fetchMediaComments, findCommentNode, postMediaComment, type MediaTarget } from "@/lib/social/mediaComments";
import { useEpisodeComments, useEpisodeSpoilerProtection } from "@/lib/social/useEpisodeComments";
import { pickImageFromLibrary, uploadCommentImage } from "@/lib/imageUpload";
import { EpisodeCommentItem } from "@/components/episode/EpisodeCommentItem";
import { LikeButton } from "@/components/feed/LikeButton";
import { SpoilerGate } from "@/components/reviews/SpoilerGate";
import { Screen, Text, Button } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { AdaptiveImage } from "@/components/media/AdaptiveImage";
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
 * TASK-132/133 — tela dedicada de comentário de episódio, a pedido,
 * diverge do web de propósito: "Responder" navega (TASK-132), e
 * ganhou avatar/curtir/anexar imagem (TASK-133), nenhum dos três
 * presentes no CommentItem do web.
 */
export default function EpisodeCommentDetailScreen() {
  const router = useRouter();
  const { session } = useAuth();
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
  const autoHideSpoilers = useEpisodeSpoilerProtection(seriesIdNum, seasonNumber, episodeNumber);

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
        setUploadError(result.error ?? "Não foi possível enviar a imagem agora.");
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
    Alert.alert("Apagar este comentário?", "Não dá pra desfazer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await remove(comment.id);
            router.back();
          } catch (error) {
            console.error("[EpisodeCommentDetailScreen] Falha ao apagar comentário", error);
            Alert.alert("Não foi possível apagar", error instanceof Error ? error.message : "Tente de novo em instantes.");
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
      Alert.alert("Não foi possível editar", error instanceof Error ? error.message : "Tente de novo em instantes.");
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

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Comentário</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <AvatarRowSkeleton count={1} />
        ) : !comment ? (
          <Text variant="muted" style={styles.centerText}>
            Este comentário não existe mais.
          </Text>
        ) : (
          <>
            <View style={styles.commentCard}>
              {editingTop ? (
                <View>
                  <TextInput value={editTopBody} onChangeText={setEditTopBody} multiline autoFocus style={styles.editInput} />
                  <View style={styles.editButtons}>
                    <Pressable onPress={() => setEditingTop(false)} style={styles.editCancelButton}>
                      <Text variant="muted">Cancelar</Text>
                    </Pressable>
                    <View style={styles.editSaveButton}>
                      <Button onPress={handleSaveEditTop} loading={savingTop} disabled={!editTopBody.trim()}>
                        Salvar
                      </Button>
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.commentHeader}>
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
                      {!!comment.imageUrl && <AdaptiveImage uri={comment.imageUrl} maxHeight={320} />}
                    </View>
                  </SpoilerGate>
                  <View style={styles.ownActionsRow}>
                    <LikeButton targetType="comment" targetId={comment.id} />
                    {isOwn && (
                      <>
                        <Pressable
                          onPress={() => {
                            setEditTopBody(comment.body ?? "");
                            setEditingTop(true);
                          }}
                        >
                          <Text variant="muted" style={styles.editLabel}>
                            Editar
                          </Text>
                        </Pressable>
                        <Pressable onPress={handleDeleteTop}>
                          <Text style={styles.deleteLabel}>Apagar</Text>
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
                  Nenhuma resposta ainda.
                </Text>
              ) : (
                comment.children.map((child) => (
                  <EpisodeCommentItem
                    key={child.id}
                    comment={child}
                    depth={0}
                    autoHideSpoilers={autoHideSpoilers}
                    commentsBaseHref={commentsBaseHref}
                    onDelete={handleDelete}
                    onEdit={handleEdit}
                  />
                ))
              )}
            </View>

            <View style={styles.composerArea}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Escreva uma resposta..."
                placeholderTextColor={colors.muted}
                multiline
                style={styles.input}
              />

              {imageUri ? (
                <View style={styles.imagePreviewWrapper}>
                  <ExpoImage source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" autoplay />
                  <Pressable
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

              <Pressable style={styles.attachButton} onPress={handlePickImage} disabled={busy}>
                <Feather name="image" size={14} color={colors.muted} />
                <Text variant="muted" style={styles.attachButtonText}>
                  {imageUri ? "Trocar imagem" : "Anexar imagem ou GIF"}
                </Text>
              </Pressable>

              <View style={styles.composerFooter}>
                <Pressable style={styles.spoilerToggle} onPress={() => setMarkSpoiler((v) => !v)}>
                  <Feather name={markSpoiler ? "check-square" : "square"} size={16} color={markSpoiler ? colors.primary : colors.muted} />
                  <Text variant="muted" style={styles.spoilerLabel}>
                    Contém spoiler
                  </Text>
                </Pressable>
                <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={(!body.trim() && !imageUri) || busy}>
                  <Text style={styles.sendButtonText}>{uploadingImage ? "Enviando…" : "Enviar"}</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const AVATAR_SIZE = 28;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centerText: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  commentCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  commentHeader: {
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
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  date: {
    fontSize: 11,
  },
  body: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  ownActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  editLabel: {
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
  repliesArea: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  composerArea: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  input: {
    minHeight: 60,
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
    backgroundColor: "rgba(11,14,20,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  attachButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
  },
  attachButtonText: {
    fontSize: 12,
  },
  composerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  spoilerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  spoilerLabel: {
    fontSize: 12,
  },
  sendButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  sendButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.background,
  },
});
