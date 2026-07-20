import { useState } from "react";
import { View, Modal, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { createTextPost } from "@/lib/posts";
import { createPollPost } from "@/lib/social/polls";
import { pickImageFromLibrary, uploadPostImage } from "@/lib/imageUpload";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const MAX_LENGTH = 500;
const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;

/**
 * TASK-111 (seletor de imagem) — ganhou o anexo de imagem/GIF que
 * tinha ficado de fora na leva original do Feed. Upload só acontece
 * ao publicar (não ao escolher o arquivo), mesma ordem do web. Post
 * de review continua de fora — depende da tela de Avaliações, que já
 * tem seu próprio fluxo de publicar (`ReviewsSection`), não esta.
 *
 * TASK-163 (enquete, mobile-only) — mesmo composer ganhou um segundo
 * modo. Enquete usa o campo principal como pergunta (sem anexo de
 * imagem — não faz sentido misturar os dois no primeiro momento) e
 * ganha campos extras pras opções (mínimo 2, máximo 4). Voto é
 * definitivo e resultado só aparece pra quem já votou — regras vivem
 * no service (`lib/social/polls.ts`) e no `PollBlock`, não aqui.
 */
export function CreatePostButton({ onCreated }: { onCreated: () => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"post" | "poll">("post");
  const [body, setBody] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [posting, setPosting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  function resetForm() {
    setMode("post");
    setBody("");
    setImageUri(null);
    setImageMimeType(null);
    setUploadError(null);
    setPollQuestion("");
    setPollOptions(["", ""]);
  }

  function handleOpen() {
    resetForm();
    setOpen(true);
  }

  function handlePollOptionChange(index: number, value: string) {
    setPollOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }

  function handleAddPollOption() {
    setPollOptions((prev) => (prev.length >= MAX_POLL_OPTIONS ? prev : [...prev, ""]));
  }

  function handleRemovePollOption(index: number) {
    setPollOptions((prev) => (prev.length <= MIN_POLL_OPTIONS ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handlePickImage() {
    setUploadError(null);
    const picked = await pickImageFromLibrary();
    if (!picked) return;
    setImageUri(picked.uri);
    setImageMimeType(picked.mimeType);
  }

  async function handlePublish() {
    if (mode === "poll") {
      setPosting(true);
      try {
        await createPollPost(pollQuestion, pollOptions);
        setOpen(false);
        onCreated();
      } catch (error) {
        console.error("[CreatePostButton] Falha ao publicar enquete", error);
        Alert.alert("Não foi possível publicar", "Confira a pergunta e pelo menos 2 opções, e tente de novo.");
      } finally {
        setPosting(false);
      }
      return;
    }

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
  const pollFilledOptionsCount = pollOptions.filter((o) => o.trim().length > 0).length;
  const canPublishPoll = pollQuestion.trim().length > 0 && pollFilledOptionsCount >= MIN_POLL_OPTIONS;
  const canPublish = mode === "poll" ? canPublishPoll : !!body.trim() || !!imageUri;

  return (
    <>
      <Pressable style={[styles.fab, { bottom: 84 + insets.bottom }]} onPress={handleOpen}>
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
              <Text variant="subtitle">{mode === "poll" ? "Nova enquete" : "Novo post"}</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.modeToggle}>
              <Pressable style={[styles.modeButton, mode === "post" && styles.modeButtonActive]} onPress={() => setMode("post")}>
                <Feather name="edit-3" size={14} color={mode === "post" ? colors.background : colors.muted} />
                <Text style={[styles.modeButtonText, mode === "post" && styles.modeButtonTextActive]}>Post</Text>
              </Pressable>
              <Pressable style={[styles.modeButton, mode === "poll" && styles.modeButtonActive]} onPress={() => setMode("poll")}>
                <Feather name="bar-chart-2" size={14} color={mode === "poll" ? colors.background : colors.muted} />
                <Text style={[styles.modeButtonText, mode === "poll" && styles.modeButtonTextActive]}>Enquete</Text>
              </Pressable>
            </View>

            {mode === "poll" ? (
              <>
                <TextInput
                  style={styles.textAreaSmall}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  placeholder="Qual é a pergunta?"
                  placeholderTextColor={colors.muted}
                  multiline
                  maxLength={140}
                  autoFocus
                />

                <View style={styles.pollOptionsList}>
                  {pollOptions.map((option, index) => (
                    <View key={index} style={styles.pollOptionRow}>
                      <TextInput
                        style={styles.pollOptionInput}
                        value={option}
                        onChangeText={(value) => handlePollOptionChange(index, value)}
                        placeholder={`Opção ${index + 1}`}
                        placeholderTextColor={colors.muted}
                        maxLength={60}
                      />
                      {pollOptions.length > MIN_POLL_OPTIONS && (
                        <Pressable hitSlop={8} onPress={() => handleRemovePollOption(index)}>
                          <Feather name="x" size={16} color={colors.muted} />
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>

                {pollOptions.length < MAX_POLL_OPTIONS && (
                  <Pressable style={styles.attachButton} onPress={handleAddPollOption}>
                    <Feather name="plus" size={16} color={colors.muted} />
                    <Text variant="muted" style={styles.attachButtonText}>
                      Adicionar opção
                    </Text>
                  </Pressable>
                )}

                <Text variant="muted" style={styles.pollHint}>
                  Voto é definitivo e o resultado só aparece depois de votar.
                </Text>
              </>
            ) : (
              <>
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
              </>
            )}

            <Button onPress={handlePublish} loading={busy} disabled={!canPublish}>
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
    // TASK-172/176 — 92px = 12 (margem da barra) + 64 (altura da
    // barra) + 16 (respiro) acima dela; o `insets.bottom` (área do
    // sistema — gestos/botões, varia por aparelho) é somado no
    // lugar onde o componente usa esse estilo, não aqui (Style
    // estático não tem acesso ao hook de área segura).
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
  modeToggle: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    color: colors.muted,
  },
  modeButtonTextActive: {
    color: colors.background,
  },
  textAreaSmall: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: "top",
  },
  pollOptionsList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  pollOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  pollOptionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  pollHint: {
    fontSize: 11,
    marginTop: spacing.xs,
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
