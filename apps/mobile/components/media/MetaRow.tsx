import { StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { Text, Glass } from "@/components/ui";
import { colors, fontSize } from "@/lib/theme";

/**
 * A PEDIDO (confirmação de paridade web/mobile, reportado com print)
 * — porta de `MetaRow.tsx` do web: card com fundo próprio (não só
 * texto solto), valor grande em cima, rótulo pequeno embaixo — não
 * o contrário. Antes o mobile tinha DUAS cópias quase iguais dessa
 * mesma peça (uma em `app/series/[id].tsx`, outra em
 * `app/movies/[id].tsx`), cada uma só com texto puro, sem chip
 * nenhum. Um componente só agora, reaproveitado pelos dois.
 *
 * `icon` é opcional, um elemento pronto (`<Feather name="calendar"
 * .../>`) — mesmo padrão do web (`icon={<Calendar .../>}`). Só a
 * série usa; filme nunca teve ícone nesses cards, nem no próprio web
 * (`MovieInfo.tsx`).
 *
 * PORTE DO WEB (2026-09-09) — quatro diferenças achadas comparando
 * com o `MetaRow.tsx` do web lado a lado:
 *
 * 1. O card era SÓLIDO (`colors.surface` + borda `colors.border`,
 *    escura). No web é vidro: `border border-white/10
 *    backdrop-blur-[10px] backdrop-saturate-[160%]` + brilho 0.13 /
 *    base 0.06 — a receita `light` do `Glass`.
 * 2. Canto 10 (`radius.md`); o web usa `rounded-xl` = 12.
 * 3. Recheio 8/8; o web usa `px-3 py-2.5` = 12 na horizontal e 10 na
 *    vertical — o card do mobile era visivelmente mais apertado.
 * 4. O valor estava em peso 700 e podia ocupar DUAS linhas; no web é
 *    `font-semibold` (600) e `truncate` (uma linha só). Duas linhas
 *    aqui desalinhavam a grade de duas colunas. O rótulo também
 *    tinha `marginTop: 2` que o web não tem (o `<p>` do Tailwind
 *    entra com margem zero).
 *
 * A LARGURA saiu daqui: era `width: "47%"` fixo, o que só funcionava
 * com o espaçamento antigo. O web usa `grid grid-cols-2 gap-2` —
 * duas colunas EXATAS que dividem a sobra. `flexGrow: 1` +
 * `flexBasis: "40%"` reproduz isso num `flexWrap`: cabem dois por
 * linha e os dois crescem igual até fechar a linha, seja qual for o
 * `gap` que o chamador usar.
 */
export function MetaRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <Glass style={styles.card} variant="light">
      {icon}
      <Text numberOfLines={1} style={styles.value}>
        {value}
      </Text>
      <Text variant="muted" style={styles.label}>
        {label}
      </Text>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: "40%",
    /* Trava em meia largura pra um item sozinho na última linha (quantidade ímpar) não esticar até a borda — numa grade de duas colunas ele fica com metade, como no web. */
    maxWidth: "50%",
    borderRadius: 12, // `rounded-xl`
    paddingHorizontal: 12, // `px-3`
    paddingVertical: 10, // `py-2.5`
  },
  /** `text-sm font-semibold` = 14/600 (era 700). */
  value: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  /** `text-[11px] text-muted`, sem margem (o `<p>` do web tem margem zero). */
  label: {
    fontSize: 11,
  },
});
