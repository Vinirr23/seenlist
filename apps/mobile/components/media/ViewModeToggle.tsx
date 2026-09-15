import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ViewMode } from "@/lib/useViewModePreference";
import { Glass } from "@/components/ui";
import { colors, radius } from "@/lib/theme";

/**
 * PORTE DO WEB (2026-09-09, a pedido — "o switch de lista para grade
 * continua com o design antigo").
 *
 * Fonte: `apps/web/components/media/ViewModeToggle.tsx`. Estava
 * diferente em quatro pontos, não só um:
 *
 *   CONTÊINER — era `borderColor: colors.border` (cinza escuro) sem
 *   vidro. No web é
 *   `rounded-lg border border-white/10 p-0.5 backdrop-blur-[10px]
 *   backdrop-saturate-[160%]` sobre `radial(...0.13...), 0.06` — a
 *   receita `light` do `Glass`, a mesma da trilha das abas e da pílula
 *   de título de seção.
 *
 *   RAIO — `rounded-lg` = 8; estava `radius.md` = 10.
 *
 *   RESPIRO ENTRE OS DOIS — `gap-1` = 4; estava 2.
 *
 *   ESTADO ATIVO — era `colors.surface`, um cinza. No web é
 *   `bg-primary/20`, âmbar a 20% (o ícone já era `text-primary` nos
 *   dois).
 */
export function ViewModeToggle({ viewMode, onChange }: { viewMode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <Glass style={styles.wrapper} variant="light">
      <Pressable
        hitSlop={8}
        style={[styles.button, viewMode === "grid" && styles.buttonActive]}
        onPress={() => onChange("grid")}
      >
        <Feather name="grid" size={16} color={viewMode === "grid" ? colors.primary : colors.muted} />
      </Pressable>
      <Pressable
        hitSlop={8}
        style={[styles.button, viewMode === "list" && styles.buttonActive]}
        onPress={() => onChange("list")}
      >
        <Feather name="list" size={16} color={viewMode === "list" ? colors.primary : colors.muted} />
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  /** Borda e fundo saíram: quem desenha é o `Glass`. `p-0.5` = 2, `gap-1` = 4, `rounded-lg` = 8. */
  wrapper: {
    flexDirection: "row",
    alignSelf: "flex-start",
    gap: 4,
    borderRadius: 8,
    padding: 2,
  },
  /** `rounded-md` = 6 (= `radius.sm`), `p-1.5` = 6. */
  button: {
    padding: 6,
    borderRadius: radius.sm,
  },
  /** `bg-primary/20` do web. */
  buttonActive: {
    backgroundColor: "rgba(232,163,61,0.2)",
  },
});
