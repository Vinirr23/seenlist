import { useState } from "react";
import { View, Modal, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { createTextPost } from "@/lib/posts";
import { pickImageFromLibrary, uploadPostImage } from "@/lib/imageUpload";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const MAX_LENGTH = 500;

/**
 * TASK-111 (seletor de imagem) — ganhou o anexo de imagem/GIF que
 * tinha ficado de fora na leva original do Feed. Upload só acontece
 * ao publicar (não ao escolher o arquivo), mesma ordem do web. Post
 * de review continua de fora — depende da tela de Avaliações, que já
 * tem seu próprio fluxo de publicar (`ReviewsSection`), não esta.
 */
export function CreatePostButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  function resetForm() {
    setBody("");
    setImageUri(null);
    setImageMimeType(null);
    setUploadError(null);
  }

  function handleOpen() {
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
    setUploadError(null);

    let uploadedImageUrl: string | null = null;
    if (imageUri && imageMimeType) {
      setUploadingImage(true);
      const result = await uploadPostImage(imageUri, imageMimeType);
      setUploadingImage(false);
      if (result.error || !result.url) {
        setUploadError(result.error ?? "Não foi possível enviar a imagem agora.");
        return;
      }
      uploadedImageUrl = result.url;
    }

    setPosting(true);
    try {
      await createTextPost(body, uploadedImageUrl);
      setOpen(false);
      onCreated();
    } catch (error) {
      console.error("[CreatePostButton] Falha ao publicar", error);
      Alert.alert("Não foi possível publicar", "Tente de novo em instantes.");
    } finally {
      setPosting(false);
    }
  }

  const busy = posting || uploadingImage;

  return (
    <>
      <Pressable style={styles.fab} onPress={handleOpen}>
        <Feather name="plus" size={24} color={colors.background} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        {/* TASK-136 (correção — teclado cobrindo o campo) — "undefined" no Android não fazia nada; dentro de um Modal, o Android não ajusta a janela sozinho como faz numa tela normal (é uma janela nativa separada) — precisa do KeyboardAvoidingView de verdade. "height" é o comportamento que funciona de forma confiável dentro de Modal no Android ("padding" tem comportamento inconsistente nesse contexto específico). */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text variant="muted">Cancelar</Text>
              </Pressable>
              <Text variant="subtitle">Novo post</Text>
              <View style={{ width: 60 }} />
            </View>

            <TextInput
              style={styles.textArea}
              value={body}
              onChangeText={setBody}
              placeholder="O que você está pensando?"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={MAX_LENGTH}
              autoFocus
            />
            <Text variant="muted" style={styles.counter}>
              {body.length}/{MAX_LENGTH}
            </Text>

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
              <Feather name="image" size={16} color={colors.muted} />
              <Text variant="muted" style={styles.attachButtonText}>
                {imageUri ? "Trocar imagem" : "Anexar imagem ou GIF"}
              </Text>
            </Pressable>

            <Button onPress={handlePublish} loading={busy} disabled={!body.trim() && !imageUri}>
              {uploadingImage ? "Enviando imagem..." : "Publicar"}
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
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
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
  counter: {
    textAlign: "right",
    fontSize: 11,
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
});
