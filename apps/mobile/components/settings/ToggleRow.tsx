import { View, Switch, StyleSheet } from "react-native";
import { Text } from "@/components/ui";
import { hapticSelection } from "@/lib/haptics";
import { colors, spacing, fontSize } from "@/lib/theme";

export function ToggleRow({
  label,
  value,
  onChange,
  disabled,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(next) => {
          hapticSelection();
          onChange(next);
        }}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — o
    // `minHeight: 52` original vinha de igualar com `SettingsRow`
    // (que também era 52). `SettingsRow` foi reduzida pra 44 numa
    // auditoria de paridade com o web (ver comentário lá) e este
    // componente ficou pra trás, sem ninguém revisitar — hoje nenhuma
    // tela mistura os dois no mesmo bloco (a justificativa original de
    // "igualar os dois" já não existe, `SettingsRow.tsx` diz isso com
    // todas as letras), então não há mais motivo pro valor diferir.
    // `paddingHorizontal` tinha a mesma origem (12 vs 16) — alinhado
    // junto.
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
});
