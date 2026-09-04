import { useState } from "react";
import { View, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { sendFeedback, type FeedbackType } from "@/lib/settings";
import { Screen, Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize, tint } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export default function FeedbackScreen() {
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

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendFeedback(type, trimmed);
      setMessage("");
      setSent(true);
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {sent ? (
          <View style={styles.sentBox}>
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
          </View>
        ) : (
          <View style={styles.form}>
            <View>
              <Text variant="muted" style={styles.label}>
                {t("feedback.aboutWhat")}
              </Text>
              <View style={styles.typeList}>
                {TYPES.map((option) => {
                  const selected = type === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[styles.typeButton, selected && styles.typeButtonActive]}
                      onPress={() => setType(option.value)}
                    >
                      <Feather name={option.icon} size={16} color={selected ? colors.primary : colors.text} />
                      <Text style={selected ? styles.typeLabelActive : styles.typeLabel}>{option.label}</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
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
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  typeButtonActive: {
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
  sentBox: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
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
});
