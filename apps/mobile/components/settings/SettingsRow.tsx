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
          <Text variant="muted" style={styles.value} numberOfLines={1}>
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
    // CORREÇÃO (auditoria de consistência) — altura mínima igual nas
    // duas linhas de Configurações. `ToggleRow` tem um `Switch`
    // nativo (~31px de altura) e `SettingsRow` só texto (~18px):
    // com o mesmo `paddingVertical`, as duas ficavam com alturas
    // diferentes no MESMO bloco, dando um ritmo visual irregular na
    // lista. `minHeight` iguala sem esticar o que já é maior.
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
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
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    maxWidth: "55%",
  },
  value: {
    fontSize: fontSize.xs,
  },
});
