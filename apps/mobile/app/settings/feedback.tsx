import { useState, useCallback } from "react";
import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { sendFeedback, fetchMyFeedback, type FeedbackType, type MyFeedbackItem } from "@/lib/settings";
import { Screen, Text, Button, GlassTargetProvider, Glass, AmbientGlow } from "@/components/ui";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize, tint } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

export default function FeedbackScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const TYPES: { value: FeedbackType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { value: "bug", label: t("feedback.typeBug"), icon: "alert-triangle" },
    { value: "suggestion", label: t("feedback.typeSuggestion"), icon: "zap" },
    { value: "other", label: t("feedback.typeOther"), icon: "message-square" },
  ];
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [myFeedback, setMyFeedback] = useState<MyFeedbackItem[]>([]);

  /**
   * A PEDIDO (2026-09-16 — "onde eu recebo o feedback, e posso
   * responder ele?") — histórico do que o usuário já mandou, com a
   * resposta em destaque quando já tiver uma. Idêntico ao `useMyFeedback`
   * do web, só que como função simples (mobile não usa react-query).
   */
  const reloadMyFeedback = useCallback(() => {
    fetchMyFeedback().then(setMyFeedback);
  }, []);
  useFocusEffect(reloadMyFeedback);

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendFeedback(type, trimmed);
      setMessage("");
      setSent(true);
      reloadMyFeedback();
    } catch (error) {
      console.error("[FeedbackScreen] Falha ao enviar feedback", error);
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("settings.sendFeedback")}</Text>
      </View>

      {/*
        * CORREÇÃO (auditoria — mesmo achado de `edit-profile.tsx`):
        * tela de formulário sem rolagem nem tratamento de teclado. O
        * campo de texto aqui é longo (até 2000 caracteres) e fica
        * embaixo — com o teclado aberto, ele mesmo e o botão de
        * enviar ficavam cobertos, sem como rolar até eles.
        */}
      {/*
        * CORREÇÃO (a pedido, 2026-09-15/16 — "as cores de fundo da
        * tela devem ser as mesmas do restante do app, que é azul")
        * — esta tela usava o `AmbientGlow` SEM `blobs`, caindo na
        * paleta genérica âmbar/teal do componente (`BLOBS`, em
        * `components/ui/Glass.tsx`) — a única do app que não é azul.
        * TODAS as outras telas (abas E sub-telas) passam um `blobs`
        * próprio, sempre nos mesmos 3 tons de azul
        * (`rgba(27,75,122,...)`/`rgba(42,127,184,...)`/
        * `rgba(13,59,92,...)`, só o `top`/opacidade muda) — ver
        * `lib/glowBlobs.ts`. Esta é uma sub-tela "voltar + título"
        * como Comentários/Minhas listas, então usa o mesmo
        * `SUBPAGE_GLOW_BLOBS` delas, em vez de inventar um array novo.
        */}
      <GlassTargetProvider style={styles.flex} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]} keyboardShouldPersistTaps="handled">
        {sent ? (
          <Glass style={styles.sentBox}>
            <View style={styles.sentIcon}>
              <Feather name="check" size={24} color={colors.primary} />
            </View>
            <Text variant="subtitle">{t("feedback.sentTitle")}</Text>
            <Text variant="muted" style={styles.sentText}>
              {t("feedback.sentMessage")}
            </Text>
            <Pressable onPress={() => setSent(false)}>
              <Text variant="link">{t("feedback.sendAnother")}</Text>
            </Pressable>
          </Glass>
        ) : (
          <View style={styles.form}>
            <View>
              <Text variant="muted" style={styles.label}>
                {t("feedback.aboutWhat")}
              </Text>
              <View style={styles.typeList}>
                {TYPES.map((option) => {
                  const selected = type === option.value;
                  // CORREÇÃO (2026-09-04, "vidro que falta") — web só
                  // aplica vidro no estado NÃO selecionado (o
                  // selecionado é sólido `bg-primary/10`, sem blur) —
                  // por isso vira dois JSX diferentes, não um `style`
                  // condicional em cima de `Glass` (que sempre desenha
                  // blur, mesmo "desligado" não faria sentido visual).
                  return selected ? (
                    <Pressable key={option.value} onPress={() => setType(option.value)}>
                      <View style={[styles.typeButton, styles.typeButtonActive]}>
                        <Feather name={option.icon} size={16} color={colors.primary} />
                        <Text style={styles.typeLabelActive}>{option.label}</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <Pressable key={option.value} onPress={() => setType(option.value)}>
                      <Glass style={styles.typeButton}>
                        <Feather name={option.icon} size={16} color={colors.text} />
                        <Text style={styles.typeLabel}>{option.label}</Text>
                      </Glass>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View>
              <Text variant="muted" style={styles.label}>
                {t("feedback.detailsLabel")}
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t("feedback.placeholder")}
                placeholderTextColor={colors.muted}
                multiline
                maxLength={2000}
                style={styles.textArea}
              />
              <Text variant="muted" style={styles.counter}>
                {message.length}/2000
              </Text>
            </View>

            <Button onPress={handleSubmit} loading={sending} disabled={!message.trim()}>
              {t("settings.sendFeedback")}
            </Button>
          </View>
        )}

        {myFeedback.length > 0 && (
          <View style={styles.historySection}>
            <Text variant="muted" style={styles.label}>
              {t("feedback.myMessages")}
            </Text>
            <View style={styles.historyList}>
              {myFeedback.map((item) => (
                <View key={item.id} style={styles.historyCard}>
                  <Text style={styles.historyMessage}>{item.message}</Text>
                  {!!item.adminReply && (
                    <View style={styles.historyReply}>
                      <Text style={styles.historyReplyLabel}>{t("feedback.teamReply")}</Text>
                      <Text style={styles.historyReplyText}>{item.adminReply}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
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
    paddingBottom: spacing.xl,
  },
  // `form.gap` NÃO foi tocado — é o espaçamento vertical entre campos
  // do formulário, não borda de tela; fora do escopo desta correção.
  form: {
    gap: spacing.lg,
  },
  label: {
    fontSize: fontSize.xxs,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  typeList: {
    gap: spacing.sm,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos daqui (o estado NÃO selecionado agora é `<Glass>`, que
  // já desenha sua própria borda `border-white/10`); o estado
  // selecionado (`typeButtonActive`, sólido) declara a própria borda/
  // fundo, sem depender destes.
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  typeButtonActive: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: tint.subtle,
  },
  typeLabel: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  typeLabelActive: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: "top",
  },
  counter: {
    textAlign: "right",
    fontSize: fontSize.xxs,
    marginTop: 2,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — vira `<Glass>` (web:
  // `rounded-xl border border-white/10 backdrop-blur` no painel de
  // confirmação de envio); ganhou `borderRadius`/`paddingHorizontal`
  // próprios (antes vinham só do `content` do pai).
  sentBox: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
  },
  sentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: tint.subtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  sentText: {
    textAlign: "center",
  },
  historySection: {
    marginTop: spacing.xl,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  historyMessage: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  historyReply: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: tint.subtle,
    padding: spacing.sm,
  },
  historyReplyLabel: {
    fontSize: fontSize.xxs,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  historyReplyText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
});
