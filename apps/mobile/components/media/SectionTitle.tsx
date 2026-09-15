import { View, StyleSheet } from "react-native";
import { Text, Glass } from "@/components/ui";
import { colors, fontFamily, spacing } from "@/lib/theme";

/**
 * PORTE DO WEB (2026-09-09, comparado no print — o mobile mostrava
 * "Continue assistindo" como título comum e o web mostra uma PÍLULA de
 * vidro maiúscula).
 *
 * Fonte: `apps/web/components/media/SectionTitle.tsx`. Lá é
 *
 *     rounded-full border border-white/10 px-3.5 py-1.5
 *     text-xs font-bold uppercase tracking-wide text-muted
 *     backdrop-blur-[10px] backdrop-saturate-[160%]
 *     background: radial-gradient(75% 100% at 14% 15%,
 *                   rgba(255,255,255,0.13), transparent 60%),
 *                 rgba(255,255,255,0.06)
 *
 * que é, item por item, a receita `light` do `Glass` (`glassVariants`
 * em `lib/theme.ts`: brilho 0.13, base 0.06, desfoque 10px, borda 0.10).
 * Por isso aqui não tem número solto: só layout e tipografia.
 *
 * O `justify-center` do web NÃO foi portado de propósito: nas telas de
 * Séries/Filmes a pílula divide a linha com o seletor de visualização
 * (grade/lista) e fica encostada à esquerda — é o que o print do web
 * mostra. Quem centraliza é quem usa, se precisar.
 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.linha}>
      <Glass style={styles.pilula} variant="light">
        <Text style={styles.texto}>{children}</Text>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  /** `flex` de uma linha só: a pílula encolhe até o texto em vez de esticar. */
  linha: {
    flexDirection: "row",
  },
  pilula: {
    /* `rounded-full`: raio grande o bastante pra virar cápsula em qualquer altura. */
    borderRadius: 999,
    /* `px-3.5` = 14, `py-1.5` = 6. */
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  texto: {
    /* `text-xs` = 12, `font-bold` = 700, `tracking-wide` = 0.025em ≈ 0.3px em 12px. */
    fontSize: 12,
    fontWeight: "700",
    fontFamily: fontFamily[700],
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: colors.muted,
  },
});
