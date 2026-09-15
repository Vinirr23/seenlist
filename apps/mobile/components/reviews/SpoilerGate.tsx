import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * PORTE DO WEB (2026-09-04, "vidro que falta") — web (`SpoilerGate.tsx`)
 * usa um "toque mais leve" de vidro aqui: mantém a borda TRACEJADA
 * (função visual de "aviso" — não é o cartão neutro cheio dos
 * outros usos de `Glass`), só troca o fundo opaco por blur. `Glass`
 * já desenha blur + gradiente + brilho de borda; a única mudança por
 * cima é `borderStyle: "dashed"` no lugar da borda sólida padrão dele.
 */
export function SpoilerGate({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  if (!hidden || revealed) return <>{children}</>;

  return (
    <Pressable onPress={() => setRevealed(true)}>
      <Glass style={styles.gate}>
        <Feather name="eye-off" size={13} color={colors.muted} />
        <Text variant="muted" style={styles.text}>
          Contém spoiler — toque para revelar
        </Text>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gate: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderStyle: "dashed",
    // `Glass` não define raio nenhum — quem usa é que diz. Web: `rounded-md`.
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  text: {
    fontSize: 12,
  },
});
