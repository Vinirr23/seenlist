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
/**
 * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-17, print real medido —
 * "o seletor grade/lista está à esquerda no mobile; no web está à
 * direita"). Cheguei nisso comparando a árvore de estilos de verdade,
 * não só o print: o `wrapper` (abaixo) tinha `alignSelf: "flex-start"`
 * fixo. Numa tela como `profile/series.tsx`, onde o pai
 * (`toggleRow`) é um `View` de coluna com `alignItems: "flex-end"`
 * pedindo EXPLICITAMENTE que o filho fique à direita, esse
 * `alignSelf` no próprio componente SOBRESCREVE o pedido do pai — é
 * assim que `alignSelf` funciona no flexbox: o filho tem a palavra
 * final sobre o próprio alinhamento no eixo cruzado, não o pai. Por
 * isso o seletor sempre ficava à esquerda, não importa o que a tela
 * que o usa pedisse.
 *
 * Nas duas telas que usam `ViewModeToggle` dentro de uma LINHA
 * (`(tabs)/series/index.tsx`, `(tabs)/movies.tsx` — `sectionHeader`,
 * `flexDirection: "row"`), o `alignSelf` controlava o eixo VERTICAL,
 * não o horizontal (a posição horizontal ali já vem de
 * `justifyContent: "space-between"`) — removê-lo não muda a posição
 * horizontal nelas, só deixa de forçar "topo" e passa a herdar
 * `alignItems: "center"` do próprio `sectionHeader`, o que já
 * era o alinhamento vertical real dos outros itens da mesma linha.
 *
 * O web (`ViewModeToggle.tsx`) não tem nada parecido com
 * `self-start`/`align-self` — a posição sempre vem de quem usa o
 * componente. Fix: tirar o `alignSelf` fixo daqui, deixar cada tela
 * decidir a própria posição, igual ao web.
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
  /**
   * Borda e fundo saíram: quem desenha é o `Glass`. `p-0.5` = 2,
   * `gap-1` = 4, `rounded-lg` = 8. `alignSelf: "flex-start"` SAIU —
   * ver o comentário grande acima de `ViewModeToggle` — quem decide a
   * posição agora é sempre a tela que usa o componente, igual ao web.
   */
  wrapper: {
    flexDirection: "row",
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
