import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";

export function SettingsRow({
  label,
  value,
  onPress,
  danger,
  last,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={danger ? styles.labelDanger : styles.label}>{label}</Text>
      <View style={styles.right}>
        {!!value && (
          <Text variant="muted" style={styles.value} numberOfLines={1} ellipsizeMode="tail">
            {value}
          </Text>
        )}
        {!!onPress && <Feather name="chevron-right" size={16} color={colors.muted} />}
      </View>
    </View>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  row: {
    // CORREÇÃO (auditoria consistência web/mobile, Configurações) —
    // web (`SettingsRow.tsx` do web) usa `px-3 py-3` (12px/12px), não
    // `px-4`/16 (`spacing.md`). Linha ficava mais larga de sobra nas
    // laterais que a versão web. `minHeight` também era 52 — alto
    // demais pro texto sozinho (`text-sm`=14 + `py-3`=12*2 ≈ 44px de
    // verdade no web); reduzido pra 44. O comentário original sobre
    // igualar com `ToggleRow` (que tem `Switch`) não se aplica mais:
    // hoje nenhuma tela mistura os dois componentes no mesmo bloco.
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: spacing.sm + 4,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  labelDanger: {
    fontSize: fontSize.sm,
    color: colors.danger,
  },
  // CORREÇÃO — web: `gap-2` (8px) entre valor e chevron, não `gap-1`/4
  // (`spacing.xs`). O limite de largura também era só aproximado
  // (`55%` do container) — web trava o VALOR em si (não o bloco
  // valor+seta) em `max-w-[160px]`; movido pra `value` abaixo.
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  value: {
    fontSize: fontSize.xs,
    maxWidth: 160,
  },
});
