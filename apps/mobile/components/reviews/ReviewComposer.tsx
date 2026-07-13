import { useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Button } from "@/components/ui";
import { StarRating } from "./StarRating";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export interface ReviewComposerProps {
  initialRating?: number;
  initialText?: string | null;
  initialSpoiler?: boolean;
  isPending?: boolean;
  canShareToFeed?: boolean;
  onSubmit: (rating: number, reviewText: string | null, containsSpoiler: boolean, shareToFeed: boolean) => void;
}

/**
 * TASK-101 (Avaliações) — porta de `ReviewComposer.tsx`. Avaliação
 * rápida (só nota) e review completa (nota + texto) são o mesmo
 * formulário — texto é opcional. "Publicar também no Feed" não vem
 * marcado por padrão, mesma regra do web: publicar é decisão
 * explícita a cada vez, não automática.
 */
export function ReviewComposer({
  initialRating = 0,
  initialText = "",
  initialSpoiler = false,
  isPending,
  canShareToFeed = false,
  onSubmit,
}: ReviewComposerProps) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText ?? "");
  const [containsSpoiler, setContainsSpoiler] = useState(initialSpoiler);
  const [shareToFeed, setShareToFeed] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.starsRow}>
        <StarRating value={rating} onChange={setRating} />
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Escreva uma review (opcional)..."
        placeholderTextColor={colors.muted}
        multiline
        maxLength={4000}
        style={styles.textArea}
      />

      <Pressable style={styles.checkboxRow} onPress={() => setContainsSpoiler((v) => !v)}>
        <View style={[styles.checkbox, containsSpoiler && styles.checkboxChecked]}>
          {containsSpoiler && <Feather name="check" size={11} color={colors.background} />}
        </View>
        <Text variant="muted" style={styles.checkboxLabel}>
          Contém spoiler
        </Text>
      </Pressable>

      {canShareToFeed && (
        <Pressable style={styles.checkboxRow} onPress={() => setShareToFeed((v) => !v)}>
          <View style={[styles.checkbox, shareToFeed && styles.checkboxChecked]}>
            {shareToFeed && <Feather name="check" size={11} color={colors.background} />}
          </View>
          <Text variant="muted" style={styles.checkboxLabel}>
            Publicar também no Feed
          </Text>
        </Pressable>
      )}

      <Button
        onPress={() => onSubmit(rating, text.trim() || null, containsSpoiler, shareToFeed)}
        disabled={rating === 0}
        loading={isPending}
      >
        Salvar avaliação
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  starsRow: {
    alignItems: "center",
  },
  textArea: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    textAlignVertical: "top",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    fontSize: 12,
  },
});
