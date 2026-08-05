import { View, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * A PEDIDO (confirmação de paridade web/mobile, reportado com print)
 * — porta de `MetaRow.tsx` do web: card com fundo próprio (não só
 * texto solto), valor grande em cima, rótulo pequeno embaixo — não
 * o contrário. Antes o mobile tinha DUAS cópias quase iguais dessa
 * mesma peça (uma em `app/series/[id].tsx`, outra em
 * `app/movies/[id].tsx`), cada uma só com texto puro, sem chip
 * nenhum. Um componente só agora, reaproveitado pelos dois.
 */
export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text numberOfLines={2} style={styles.value}>
        {value}
      </Text>
      <Text variant="muted" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  value: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  label: {
    marginTop: 2,
    fontSize: 11,
  },
});
