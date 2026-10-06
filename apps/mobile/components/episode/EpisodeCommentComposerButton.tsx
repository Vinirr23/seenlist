import { useState } from "react";
import { View, Modal, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { pickImageFromLibrary, uploadCommentImage } from "@/lib/imageUpload";
import { Text, Button, PressableScale } from "@/components/ui";
import { hapticTick, hapticImpact } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { colors, radius, spacing, fontSize, elevation, scrim } from "@/lib/theme";

const MAX_LENGTH = 2000;

/**
 * "+" DE COMENTÁRIO (2026-10-06, a pedido — "na tela de comentários de
 * um episódio tem o (+) e no topo um quadrado pra escrever comentário
 * que é redundante já que o botão abre um sheet com o mesmo
 * propósito... no sheet, adicione o marcador 'contém spoiler' que tem
 * no quadrado e tire enquete").
 *
 * CAUSA RAIZ da redundância: `comments.tsx` tinha ganhado o
 * `CreatePostButton` genérico do Feed (mesmo "+" / mesmo sheet
 * "Post"/"Enquete") JUNTO do composer já existente no topo da lista
 * (`EpisodeCommentsSection`) — dois jeitos de escrever a MESMA coisa
 * na mesma tela, e pior: o `CreatePostButton` publica um POST no Feed
 * geral, não um COMENTÁRIO deste episódio — nunca fazia o que parecia
 * fazer aqui.
 *
 * Este componente substitui o `CreatePostButton` nesta tela: mesmo "+"
 * flutuante, mas o sheet é dedicado a comentário de episódio — sem
 * alternância Post/Enquete (enquete não faz sentido num comentário) e
 * com o checkbox "Contém spoiler" que antes vivia no quadrado do topo
 * (agora removido de `EpisodeCommentsSection.tsx`, ver comentário lá).
 * `onSubmit` é a mesma função `submit` de `useEpisodeComments` (que
 * `comments.tsx` já chamava), passada de fora — este componente não
 * sabe nada de Supabase/comentário, só de UI.
 */
export function EpisodeCommentComposerButton({
  onSubmit,
  sending,
}: {
  onSubmit: (body: string, containsSpoiler: boolean, parentCommentId: null, imageUrl: string | null) => Promise<boolean>;
  sending: boolean;
}) {
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [markSpoiler, setMarkSpoiler] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  function resetForm() {
    setBody("");
    setMarkSpoiler(false);
    setImageUri(null);
    setImageMimeType(null);
    setUploadError(null);
  }

  function handleOpen() {
    hapticTick();
    resetForm();
    setOpen(true);
  }

  async function handlePickImage() {
    setUploadError(null);
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setImageUri(picked.uri);
    setImageMimeType(picked.mimeType);
  }

  async function handlePublish() {
    if (!body.trim() && !imageUri) return;
    hapticTick();
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

    const ok = await onSubmit(body, markSpoiler, null, uploadedImageUrl);
    if (ok) {
      hapticImpact();
      setOpen(false);
    }
  }

  const busy = sending || uploadingImage;
  const canPublish = !!body.trim() || !!imageUri;

  return (
    <>
      <PressableScale hitSlop={8} style={[styles.fab, { bottom: tabBarClearance, right: spacing.xxl }]} onPress={handleOpen}>
        <View style={styles.fabIconWrap}>
          <Feather name="plus" size={20} color={colors.background} />
        </View>
      </PressableScale>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)} statusBarTranslucent navigationBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: spacing.lg + Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text variant="muted">{t("common.cancel")}</Text>
              </Pressable>
              <Text variant="subtitle">{t("social.newComment")}</Text>
              <View style={{ width: 60 }} />
            </View>

            <TextInput
              style={styles.textArea}
              value={body}
              onChangeText={setBody}
              placeholder={t("social.commentPlaceholder")}
              placeholderTextColor={colors.muted}
              multiline
              maxLength={MAX_LENGTH}
              autoFocus
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

            <Pressable style={styles.attachImageButton} onPress={handlePickImage} disabled={busy}>
              <Feather name="image" size={20} color={colors.muted} />
              <Text variant="muted" style={styles.attachImageButtonText}>
                {imageUri ? t("feed.changeImage") : t("social.attachImage")}
              </Text>
            </Pressable>

            {/* MARCADOR "CONTÉM SPOILER" (2026-10-06, portado do quadrado antigo — ver comentário grande no topo do arquivo). */}
            <Pressable style={styles.spoilerToggle} onPress={() => setMarkSpoiler((v) => !v)}>
              <Feather name={markSpoiler ? "check-square" : "square"} size={16} color={markSpoiler ? colors.primary : colors.muted} />
              <Text variant="muted" style={styles.spoilerLabel}>
                {t("social.containsSpoilerLabel")}
              </Text>
            </Pressable>

            <Button onPress={handlePublish} loading={busy} disabled={!canPublish}>
              {uploadingImage ? t("feed.uploadingImage") : t("common.send")}
            </Button>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    shadowColor: elevation.high.shadowColor,
    shadowOpacity: elevation.high.shadowOpacity,
    shadowRadius: elevation.high.shadowRadius,
    shadowOffset: elevation.high.shadowOffset,
    elevation: elevation.high.elevation,
  },
  fabIconWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
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
  attachImageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  attachImageButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  spoilerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: spacing.xs,
  },
  spoilerLabel: {
    fontSize: fontSize.xs,
  },
});
