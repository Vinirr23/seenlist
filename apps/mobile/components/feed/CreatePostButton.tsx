import { useState } from "react";
import { View, Modal, TextInput, Pressable, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image as ExpoImage } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { createTextPost } from "@/lib/posts";
import { createPollPost } from "@/lib/social/polls";
import { pickImageFromLibrary, uploadPostImage } from "@/lib/imageUpload";
import { Text, Button } from "@/components/ui";
import { hapticTick, hapticSuccess } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { colors, radius, spacing, fontSize, elevation, scrim } from "@/lib/theme";

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
  /*
   * BUG REAL CORRIGIDO (2026-09-28, print real — "botão + muito pra a
   * direita", encostando no dock) — CAUSA RAIZ: `styles.fab.bottom`
   * somava um número FIXO, escrito à mão (`88 = 12 [margem flutuante]
   * + 60 [altura do dock] + 16 [respiro]`) na época em que o dock
   * tinha 60px de altura. Em 2026-09-22 o dock cresceu ~15%
   * (`DOCK_SCALE`, `DockNavegacao.tsx`) — a ALTURA real virou 70px, e
   * `useTabBarClearance.ts` foi atualizado pra refletir isso (é o hook
   * que todo o resto do app já usa pra essa mesma conta) — só este
   * botão continuou com a conta antiga, feita à mão, sem usar o hook.
   * Como o Feed ficou desativado esse mês inteiro, ninguém viu esse
   * desalinhamento até religar agora. Corrigido reaproveitando o MESMO
   * hook (nunca mais duplicar essa conta manualmente).
   */
  const tabBarClearance = useTabBarClearance();
  const { t } = useTranslation();
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
    hapticTick();
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
    hapticTick();
    if (mode === "poll") {
      setPosting(true);
      try {
        await createPollPost(pollQuestion, pollOptions);
        hapticSuccess();
        setOpen(false);
        onCreated();
      } catch (error) {
        console.error("[CreatePostButton] Falha ao publicar enquete", error);
        Alert.alert(t("feed.errorPublish"), t("feed.pollValidationHint"));
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
        setUploadError(result.error ?? t("feed.errorUploadImage"));
        return;
      }
      uploadedImageUrl = result.url;
    }

    setPosting(true);
    try {
      await createTextPost(body, uploadedImageUrl);
      // A PEDIDO (feedback háptico) — publicar é o desfecho de um
      // fluxo inteiro, merece um retorno mais forte que o toque leve
      // usado em ações comuns (curtir, marcar episódio).
      hapticSuccess();
      setOpen(false);
      onCreated();
    } catch (error) {
      console.error("[CreatePostButton] Falha ao publicar", error);
      Alert.alert(t("feed.errorPublish"), t("feed.tryAgainShortly"));
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
      {/*
       * A PEDIDO (2026-09-28, mockup desenhado pelo usuário em cima do
       * print — 2ª rodada: "não era pra subir o botão, apenas colocar
       * ele um pouco acima de profile") — altura volta a ser só o
       * respiro normal acima do dock (`tabBarClearance`, sem somar
       * nada — a 1ª tentativa subiu demais). Só a posição HORIZONTAL
       * muda: mais pra esquerda, pra ficar acima do ícone "Perfil"
       * (o último dos 4 do dock) em vez de em cima da borda entre
       * "Explorar"/"Perfil". `right: spacing.xxl` é uma 1ª calibragem —
       * ainda pode precisar de ajuste fino depois de ver no aparelho.
       * E ~15% menor (56→48, ícone 24→20).
       */}
      <Pressable
        hitSlop={8}
        style={[styles.fab, { bottom: tabBarClearance, right: spacing.xxl }]}
        onPress={handleOpen}
      >
        <Feather name="plus" size={20} color={colors.background} />
      </Pressable>

      {/*
       * BUG REAL CORRIGIDO (2026-09-29, print real — "Post atrás da
       * barra de gestos", TASK-136 tinha corrigido isso antes, voltou)
       * — CAUSA RAIZ: o upgrade recente pra Expo SDK 55/RN 0.83 mira
       * uma versão do Android mais nova que TORNOU o modo edge-to-edge
       * obrigatório (deixou de ser opcional) — o Android passou a
       * deixar o `Modal` desenhar por baixo da barra de gestos também
       * (igual o resto do app, que já é edge-to-edge de propósito, ver
       * `useSafeAreaInsets()` em toda tela), só que sem os 2 flags que
       * avisam o React Native pra tratar isso direito, o conteúdo do
       * Modal ficava num meio-termo — nem o Android reservava o
       * espaço sozinho (comportamento antigo, pré-SDK 55, que o
       * TASK-136 original contava), nem o app sabia que precisava
       * desviar. `statusBarTranslucent`/`navigationBarTranslucent` são
       * os flags oficiais do RN pra isso — com eles, o `insets.bottom`
       * já somado aqui embaixo (`paddingBottom`) passa a valer de
       * verdade dentro do Modal também.
       */}
      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {/* TASK-136 (correção — teclado cobrindo o campo) — "undefined" no Android não fazia nada; dentro de um Modal, o Android não ajusta a janela sozinho como faz numa tela normal (é uma janela nativa separada) — precisa do KeyboardAvoidingView de verdade. "height" é o comportamento que funciona de forma confiável dentro de Modal no Android ("padding" tem comportamento inconsistente nesse contexto específico). */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
          {/*
            * CORREÇÃO (bug real, reportado com print — botão
            * "Publicar" atrás da barra de navegação do Android) — a
            * folha usava `padding` uniforme, sem somar a área do
            * sistema embaixo (barra de gestos/botões), então o
            * último elemento ficava parcialmente coberto. O
            * `insets` já era calculado neste componente (usado no
            * botão flutuante), só nunca tinha sido aplicado aqui.
            * `Math.max(insets.bottom, spacing.md)` garante um respiro
            * mínimo mesmo em aparelho que reporta um `insets.bottom`
            * pequeno demais (não só exatamente 0 — o `||` antigo só
            * cobria esse caso extremo).
            */}
          <View style={[styles.sheet, { paddingBottom: spacing.lg + Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text variant="muted">{t("common.cancel")}</Text>
              </Pressable>
              <Text variant="subtitle">{mode === "poll" ? t("feed.newPoll") : t("feed.newPost")}</Text>
              <View style={{ width: 60 }} />
            </View>

            <View style={styles.modeToggle}>
              <Pressable style={[styles.modeButton, mode === "post" && styles.modeButtonActive]} onPress={() => setMode("post")}>
                <Feather name="edit-3" size={14} color={mode === "post" ? colors.background : colors.muted} />
                <Text style={[styles.modeButtonText, mode === "post" && styles.modeButtonTextActive]}>{t("feed.post")}</Text>
              </Pressable>
              <Pressable style={[styles.modeButton, mode === "poll" && styles.modeButtonActive]} onPress={() => setMode("poll")}>
                <Feather name="bar-chart-2" size={14} color={mode === "poll" ? colors.background : colors.muted} />
                <Text style={[styles.modeButtonText, mode === "poll" && styles.modeButtonTextActive]}>{t("feed.poll")}</Text>
              </Pressable>
            </View>

            {mode === "poll" ? (
              <>
                <TextInput
                  style={styles.textAreaSmall}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                  placeholder={t("feed.pollQuestionPlaceholder")}
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
                        placeholder={t("feed.pollOptionPlaceholder", { number: index + 1 })}
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
                      {t("feed.addOption")}
                    </Text>
                  </Pressable>
                )}

                <Text variant="muted" style={styles.pollHint}>
                  {t("feed.pollVoteHint")}
                </Text>
              </>
            ) : (
              <>
                <TextInput
                  style={styles.textArea}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t("feed.postPlaceholder")}
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

                {/*
                  * AJUSTE VISUAL (a pedido, print de referência do app
                  * Threads, 2026-09-29) — "muito perto do botão de
                  * publicar e muito pequeno também". Sem funcionalidade
                  * nova: o botão continua chamando o mesmíssimo
                  * `handlePickImage`. Ganhou estilo PRÓPRIO
                  * (`attachImageButton`/`attachImageButtonText`, em vez
                  * do `attachButton` genérico que ainda serve só pro
                  * "Adicionar opção" da enquete) — ícone maior (16→20),
                  * viram um "chip" com fundo/borda e padding em vez de
                  * texto nu (toque maior, mais parecido com o do
                  * Threads), e `marginBottom` some com o respiro extra
                  * até o "Publicar" além do `gap` uniforme da `sheet`.
                  */}
                <Pressable style={styles.attachImageButton} onPress={handlePickImage} disabled={busy}>
                  <Feather name="image" size={20} color={colors.muted} />
                  <Text variant="muted" style={styles.attachImageButtonText}>
                    {imageUri ? t("feed.changeImage") : t("social.attachImage")}
                  </Text>
                </Pressable>
              </>
            )}

            <Button onPress={handlePublish} loading={busy} disabled={!canPublish}>
              {uploadingImage ? t("feed.uploadingImage") : t("social.publish")}
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
    /**
     * `bottom`/`right` de verdade vêm do `style` inline no JSX (ver
     * comentário ali) — dependem de `tabBarClearance` (hook) e do
     * ajuste a pedido do usuário, então não dá pra deixar fixos aqui.
     *
     * HISTÓRICO: a posição original (2026-09-15) copiava o `right-4`
     * do web (16px) sem considerar que o dock do MOBILE é um pill
     * CENTRALIZADO, mais estreito que a tela (`DOCK_MAX_WIDTH` em
     * `DockNavegacao.tsx`) — 16px da borda da tela podia cair bem em
     * cima do ícone "Perfil" do dock, dependendo da largura do
     * aparelho. Corrigido (2026-09-28, a pedido, com mockup desenhado
     * pelo usuário em cima do print) — subiu mais e puxou mais pra
     * esquerda, folga clara acima do dock inteiro.
     */
    // TAMANHO (2026-09-28, a pedido — "diminui uns 15%") — era 56;
    // 56 × 0.85 ≈ 47,6, arredondado pra 48.
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: elevation.high.shadowColor,
    shadowOpacity: elevation.high.shadowOpacity,
    shadowRadius: elevation.high.shadowRadius,
    shadowOffset: elevation.high.shadowOffset,
    elevation: elevation.high.elevation,
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
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
  pollHint: {
    fontSize: fontSize.xxs,
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
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
    fontSize: fontSize.xxs,
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
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xs` (era literal 12, mesmo valor).
    fontSize: fontSize.xs,
  },
  // Estilo dedicado do botão "Anexar imagem ou GIF" (modo post) — ver
  // comentário no JSX acima. NÃO usado pelo "Adicionar opção" da
  // enquete, que continua com `attachButton`/`attachButtonText`.
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
    marginBottom: spacing.sm,
  },
  attachImageButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
