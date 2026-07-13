import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { sendFeedback, type FeedbackType } from "@/lib/settings";
import { Screen, Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const TYPES: { value: FeedbackType; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "bug", label: "Achei um bug", icon: "alert-triangle" },
  { value: "suggestion", label: "Tenho uma sugestão", icon: "zap" },
  { value: "other", label: "Outro assunto", icon: "message-square" },
];

export default function FeedbackScreen() {
  const router = useRouter();
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
        <Text variant="subtitle">Enviar feedback</Text>
      </View>

      <View style={styles.content}>
        {sent ? (
          <View style={styles.sentBox}>
            <View style={styles.sentIcon}>
              <Feather name="check" size={24} color={colors.primary} />
            </View>
            <Text variant="subtitle">Feedback enviado, valeu!</Text>
            <Text variant="muted" style={styles.sentText}>
              Toda opinião ajuda a deixar o SeenList melhor pra beta.
            </Text>
            <Pressable onPress={() => setSent(false)}>
              <Text variant="link">Enviar outro</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <View>
              <Text variant="muted" style={styles.label}>
                SOBRE O QUÊ?
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
                CONTA COM DETALHES
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="O que aconteceu, o que você esperava que acontecesse, em qual tela..."
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
              Enviar feedback
            </Button>
          </View>
        )}
      </View>
    </Screen>
  );
}

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
  },
  form: {
    gap: spacing.lg,
  },
  label: {
    fontSize: 11,
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
    backgroundColor: "rgba(232,163,61,0.1)",
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
    fontSize: 11,
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
    backgroundColor: "rgba(232,163,61,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  sentText: {
    textAlign: "center",
  },
});
