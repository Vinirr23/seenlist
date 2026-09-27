import { useEffect, useMemo, useState } from "react";
import { ScrollView, View, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
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
import { Screen, Text, Button, GlassTargetProvider, Glass, AmbientGlow } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { AdaptiveImage } from "@/components/media/AdaptiveImage";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

/** Conta todas as respostas (em qualquer nível), igual ao helper de mesmo nome em `EpisodeCommentItem.tsx`. */
function countDescendants(node: CommentNode): number {
  let total = node.children.length;
  for (const child of node.children) total += countDescendants(child);
  return total;
}

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
  const { t } = useTranslation();
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("social.commentSingularTitle")}</Text>
      </View>

      {/*
        * PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas
        * das sub-telas (ver `lib/glowBlobs.ts`), o mesmo da tela de
        * comentários do episódio de onde se chega aqui.
        */}
      <GlassTargetProvider style={styles.flex} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
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
              * CORREÇÃO (mockup 2026-09-25, aprovado — "ficou certo") — o
              * composer estava DEPOIS da lista de respostas; a tela de
              * lista principal (`EpisodeCommentsSection.tsx`) já mostra o
              * composer no TOPO, então esta tela ficava com um
              * comportamento diferente sem motivo. Composer movido pra
              * cá, antes do comentário em destaque — resto do fluxo
              * (comentário + respostas) sem mudança de comportamento.
              */}
            <Glass style={styles.composerArea}>
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
                  <Pressable hitSlop={8}
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
                    {t("social.containsSpoilerLabel")}
                  </Text>
                </Pressable>
                <Pressable style={styles.sendButton} onPress={handleSubmit} disabled={(!body.trim() && !imageUri) || busy}>
                  <Text style={styles.sendButtonText}>{uploadingImage ? t("common.uploading") : t("common.send")}</Text>
                </Pressable>
              </View>
            </Glass>

            {/* PORTE DO WEB (2026-09-04) — o comentário em destaque vira cartão de vidro, igual ao comentário-raiz de `EpisodeCommentItem`. */}
            <Glass style={styles.commentCard}>
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
                  <Pressable style={styles.commentHeader} onPress={() => router.push(`/u/${comment.author.username}`)}>
                    <View style={styles.avatar}>
                      {comment.author.avatarUrl ? (
                        <Image source={{ uri: comment.author.avatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarInitials}>{initials(displayName)}</Text>
                      )}
                    </View>
                    <View style={styles.metaCol}>
                      <Text style={styles.authorName}>{displayName}</Text>
                      <Text variant="muted" style={styles.date}>
                        {dateFormatter.format(new Date(comment.createdAt))}
                      </Text>
                    </View>
                  </Pressable>
                  <SpoilerGate hidden={comment.containsSpoiler}>
                    <View>
                      {!!comment.body && <Text style={styles.body}>{comment.body}</Text>}
                      {!!comment.imageUrl && <AdaptiveImage uri={comment.imageUrl} maxHeight={320} />}
                    </View>
                  </SpoilerGate>
                  {/* A PEDIDO (mockup 2026-09-25, "bem melhor, pode aplicar") — linha fina separando o texto das ações, igual à referência. */}
                  <View style={styles.actionsDivider} />
                  {/*
                    * CORREÇÃO (a pedido — "coração+contador,
                    * comentário+contador, Editar e Apagar devem
                    * compartilhar exatamente o mesmo centro
                    * vertical") — container único
                    * (`ownActionsRow`, `alignItems: "center"`), ícone
                    * de resposta com o mesmo `gap` do `LikeButton`
                    * (`spacing.xs`) e dentro de uma caixa fixa 18×18
                    * (`actionIconBox`), igual ao `EpisodeCommentItem`.
                    */}
                  <View style={styles.ownActionsRow}>
                    <LikeButton targetType="comment" targetId={comment.id} />
                    {/* A PEDIDO (mockup 2026-09-25, da referência) — contador de respostas ao lado do curtir. */}
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
            </Glass>

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
      </GlassTargetProvider>
    </Screen>
  );
}

// A PEDIDO (mockup "Opção B", 2026-09-25 — "achando a fonte nos
// comentários muito pequenas e os botões também", comparado à
// referência) — 28 → 36, mesma proporção de `EpisodeCommentItem.tsx`.
const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  /**
   * CORREÇÃO (2026-09-04, decisão do usuário de 2026-09-03: padronizar
   * borda de tela em 16px app-wide) — era `spacing.lg` (24) aqui e no
   * `content`; o web usa `px-4` (`spacing.md`=16). Esta tela tinha
   * ficado de fora daquela rodada por limite de ferramenta (mora 9
   * pastas abaixo da pasta conectada, e a ponte alcança 7), não por
   * decisão — ver `comments.tsx`, irmã, mesma situação.
   */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    /**
     * CORREÇÃO (2026-09-25, bug reportado — "dentro de responder um
     * comentário, quando respondi ficou por trás da barra de
     * navegação") — esta tela nunca chamava `useTabBarClearance()`, só
     * tinha o `paddingBottom` estático abaixo (`spacing.xl`),
     * insuficiente pra reservar espaço pro dock flutuante (`position:
     * absolute`, não reserva espaço sozinho — mesma causa raiz e mesma
     * correção de `comments.tsx`, irmã). O valor dinâmico é aplicado no
     * array de estilo do `ScrollView` acima e substitui este fallback.
     */
    paddingBottom: spacing.xl,
  },
  centerText: {
    textAlign: "center",
    paddingVertical: spacing.md,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (vira `<Glass>`); raio `radius.md` → `radius.lg`, que é o
  // `rounded-2xl` dos cartões de comentário no web. `Glass` NÃO define
  // raio sozinho — ele precisa ficar declarado aqui.
  commentCard: {
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  // CORREÇÃO (mockup 2026-09-25, "a data fica embaixo do nome de
  // usuário na tela de referência") — era `row` + `justify-content:
  // space-between` (avatar+nome à esquerda, data à direita, mesma
  // linha); agora avatar de um lado e nome+data empilhados do outro
  // (`metaCol`), igual à referência.
  commentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
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
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 10 → 12, mesma proporção de `EpisodeCommentItem.tsx`.
  avatarInitials: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — sm(14) → 16.
  authorName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 11 → 13.
  date: {
    fontSize: 13,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — sm(14) → 16.
  body: {
    marginTop: spacing.xs,
    fontSize: 16,
    color: colors.text,
  },
  // A PEDIDO (mockup 2026-09-25) — linha fina entre o corpo do
  // comentário e a linha de ações, igual à referência.
  actionsDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  // A PEDIDO (mockup 2026-09-25, "alinha os botões dentro do espaço
  // que eles estão") — `flexWrap` evita que Editar/Apagar estourem o
  // card; gap menor dá mais folga antes de precisar quebrar linha.
  ownActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: spacing.xs,
    columnGap: spacing.md,
    marginTop: spacing.sm,
  },
  // A PEDIDO (mockup 2026-09-25, "os botões de like | comentários
  // estão muito pequenos") — 12px → 13px com peso, ícone do balão
  // 13px → 18px, pra bater com o `LikeButton` (ícone 18px).
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 13 → 15.
  editLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  // Mesmo `gap` do `LikeButton` (`spacing.xs`) — grupos consistentes.
  replyCountDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 12 → 15, acompanha `editLabel`/`deleteLabel`.
  replyCountLabel: {
    fontSize: 15,
  },
  // Caixa fixa — mesmo box/touch target do ícone de curtir, pra
  // alinhamento não depender do desenho interno do glifo. 18×18 →
  // 22×22 (mockup "Opção B", 2026-09-25), acompanhando o `LikeButton`.
  actionIconBox: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  // A PEDIDO (mockup "Opção B", 2026-09-25) — 13 → 15.
  deleteLabel: {
    fontSize: 15,
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
  // CORREÇÃO (2026-09-04, "vidro que falta") — mesma conversão do
  // composer de `EpisodeCommentsSection.tsx`. `marginTop` → `marginBottom`
  // (mockup 2026-09-25, aprovado) — o composer virou o primeiro elemento
  // da tela (antes ficava depois das respostas), mesma posição/
  // comportamento que a tela de lista principal já usa.
  composerArea: {
    marginBottom: spacing.md,
    borderRadius: radius.lg,
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
    backgroundColor: scrim.control,
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
