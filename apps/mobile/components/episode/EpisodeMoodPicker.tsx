import { View, Pressable, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { hapticSelection } from "@/lib/haptics";
import { colors, radius, spacing, tint, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const MOODS = [
  { key: "shocked", emoji: "😵" },
  { key: "frustrated", emoji: "😤" },
  { key: "sad", emoji: "😭" },
  { key: "thoughtful", emoji: "🤔" },
  { key: "touched", emoji: "🥺" },
  { key: "entertained", emoji: "😆" },
  { key: "scared", emoji: "😱" },
  { key: "bored", emoji: "😑" },
  { key: "content", emoji: "😌" },
  { key: "hyped", emoji: "🤩" },
  { key: "confused", emoji: "🙃" },
  { key: "tense", emoji: "😬" },
];

/**
 * TASK-173 (antes: escolha única) — múltipla escolha: cada toque alterna esse humor na lista, sem desmarcar os outros.
 *
 * CORREÇÃO (2026-09-22, bug reportado) — `label` de cada humor era um
 * literal em português fixo no array, nunca passava por `t()`. Trocado
 * pela chave `episode.mood.${key}` (mesmo padrão já usado no web,
 * `EpisodeMoodPicker.tsx`), com as 12 chaves adicionadas em pt-BR/en/es.
 *
 * FASE 1 (auditoria de consistência, 2026-09-26 — "resiliência
 * PT/EN/ES, sem diminuir agressivamente a fonte") — causa raiz: a
 * grade de 4 colunas (`CARD_WIDTH = "23%"`) já deixava pouca largura
 * de sobra pra rótulo nenhum, e o `fontSize.micro` (10) usado aqui já
 * é o menor token tipográfico do app — não dava mais pra encolher.
 * Alguns rótulos mais longos (`"Compreensivo"`, `"Conmocionado"`,
 * `"Entretenido"`) cortavam com reticências em `numberOfLines={1}`
 * antes de caber. Correção em duas partes, nenhuma delas mexendo no
 * tamanho BASE da fonte: (1) grade de 4 → 3 colunas — cada card ganha
 * ~35% mais largura; (2) `adjustsFontSizeToFit` com
 * `minimumFontScale` como rede de segurança — só encolhe o rótulo
 * daquele card específico, e só até um piso ainda legível, se mesmo
 * com a grade mais larga um texto futuro (tradução nova, nome maior)
 * não couber.
 */
export function EpisodeMoodPicker({ value, onChange }: { value: string[]; onChange: (moods: string[]) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {MOODS.map((mood) => {
        const selected = value.includes(mood.key);
        return (
          <Pressable
            key={mood.key}
            style={[styles.card, selected && styles.cardActive]}
            onPress={() => {
              hapticSelection();
              onChange(selected ? value.filter((m) => m !== mood.key) : [...value, mood.key]);
            }}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text
              style={[styles.label, selected && styles.labelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {t(`episode.mood.${mood.key}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// A PEDIDO (auditoria de consistência, 2026-09-26) — 4 colunas (23%) →
// 3 colunas (31%): mais largura por rótulo, sem mexer na fonte.
const CARD_WIDTH = "31%";

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    width: CARD_WIDTH,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    // A PEDIDO (auditoria de consistência, 2026-09-26) — não existia
    // nenhuma folga horizontal; o rótulo ia até a borda do card.
    paddingHorizontal: 2,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.xs,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: tint.subtle,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xl` (era literal 22, mesmo valor).
  emoji: {
    fontSize: fontSize.xl,
  },
  label: {
    fontSize: fontSize.micro,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
  },
  labelActive: {
    color: colors.primary,
  },
});
