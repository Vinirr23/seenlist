import { Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text, Glass } from "@/components/ui";
import { colors, fontFamily, fontSize, radius } from "@/lib/theme";

/**
 * PORTE DO WEB (2026-09-09, a pedido — "você não adicionou o botão de
 * 'Ver tudo' na home Séries").
 *
 * Fonte: `MinhaListaSection.tsx` do web, o botão logo abaixo dos cards
 * de "Continue assistindo":
 *
 *     mt-3 flex justify-center
 *     → flex items-center gap-1.5 rounded-full border border-white/10
 *       px-4 py-2 text-sm font-medium text-text
 *       backdrop-blur-[10px] backdrop-saturate-[160%]
 *       background: radial(...0.13...), rgba(255,255,255,0.06)
 *
 * O `background`+borda+blur são, de novo, a receita `light` do `Glass`
 * — a mesma da pílula de título de seção, da trilha das abas e do
 * alternador grade/lista. O comentário do web registra que este é o
 * mesmo visual do botão "Carregar mais" de outras telas, reaproveitado
 * em vez de inventar um botão novo; por isso aqui ele nasce como
 * componente, não solto dentro da tela.
 */
export function ViewAllButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.linha}>
      <Glass style={styles.botao} variant="light">
        <Text style={styles.texto}>{label}</Text>
        {/* `h-4 w-4` = 16. */}
        <Feather name="chevron-right" size={16} color={colors.text} />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** `mt-3 flex justify-center` do web. */
  linha: {
    marginTop: 12,
    alignItems: "center",
  },
  botao: {
    flexDirection: "row",
    alignItems: "center",
    /* `gap-1.5` = 6, `px-4` = 16, `py-2` = 8. */
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  texto: {
    /* `text-sm font-medium text-text`. */
    fontSize: fontSize.sm,
    fontWeight: "500",
    fontFamily: fontFamily[500],
    color: colors.text,
  },
});
