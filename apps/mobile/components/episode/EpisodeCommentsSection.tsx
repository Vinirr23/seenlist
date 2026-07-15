import { useState } from "react";
import { View, Image, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MediaTarget } from "@/lib/social/mediaComments";
import { useEpisodeComments, useEpisodeSpoilerProtection } from "@/lib/social/useEpisodeComments";
import { pickImageFromLibrary, uploadCommentImage } from "@/lib/imageUpload";
import { EpisodeCommentItem } from "./EpisodeCommentItem";
import { Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-122/129/132/133 (episódio, correção) — árvore de respostas +
 * proteção contra spoiler + composer no topo + anexar imagem/GIF
 * (TASK-133, a pedido — mesmo padrão do `CreatePostButton.tsx`:
 * prévia 140×140 com botão de remover, upload só ao publicar).
 */
export function EpisodeCommentsSection({ seriesId, target }: { seriesId: number; target: MediaTarget }) {
  const { tree, isLoading, sending, submit, remove, edit } = useEpisodeComments(target);
  const autoHideSpoilers = useEpisodeSpoilerProtection(seriesId, target.seasonNumber ?? 0, target.episodeNumber ?? 0);
  const commentsBaseHref = `/episodes/${target.mediaId}/${target.seasonNumber}/${target.episodeNumber}`;

  const [body, setBody] = useState("");
  const [markSpoiler, setMarkSpoiler] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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

    const ok = await submit(body, markSpoiler, null, uploadedImageUrl);
    if (ok) {
      setBody("");
      setMarkSpoiler(false);
      setImageUri(null);
      setImageMimeType(null);
    }
  }

  const busy = sending || uploadingImage;

  return (
    <View style={styles.wrapper}>
      <View style={styles.composerArea}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Escreva um comentário..."
          placeholderTextColor={colors.muted}
          multiline
          style={styles.input}
        />

        {imageUri ? (
          <View style={styles.imagePreviewWrapper}>
            <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
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

      {isLoading ? (
        <AvatarRowSkeleton count={3} />
      ) : tree.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          Nenhum comentário ainda. Seja o primeiro a comentar.
        </Text>
      ) : (
        <View>
          {tree.map((node) => (
            <EpisodeCommentItem
              key={node.id}
              comment={node}
              depth={0}
              autoHideSpoilers={autoHideSpoilers}
              commentsBaseHref={commentsBaseHref}
              onDelete={remove}
              onEdit={edit}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  centerText: {
    paddingVertical: spacing.sm,
  },
  composerArea: {
    marginBottom: spacing.md,
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
