import { useState, useMemo } from "react";
import { View, Modal, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Text } from "@/components/ui";
import { COUNTRIES } from "@/lib/countries";
import { colors, radius, spacing, fontSize, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO — troca do campo "país" de texto livre pra lista fechada.
 * Motivo real, não só estético: `check-new-releases` (notificação de
 * episódio novo) passou a decidir "isso é hoje?" usando o fuso do
 * país de cada pessoa — com texto livre, "Brasil"/"brazil"/"BR"/erro
 * de digitação exigiam um mapeamento cada vez mais frágil pra cobrir
 * variação. Com lista fechada, o valor salvo sempre bate exato com
 * o que o mapeamento de fuso já espera.
 */
export function CountryPicker({
  value,
  onChange,
  visible,
  onClose,
}: {
  value: string;
  onChange: (country: string) => void;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter((c) => t(c.labelKey).toLowerCase().includes(query));
  }, [search, t]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text variant="subtitle">{t("settings.selectCountry")}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("settings.searchCountry")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = value === item.value;
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onChange(item.value);
                    onClose();
                  }}
                >
                  <Text style={selected ? styles.rowTextSelected : styles.rowText}>{t(item.labelKey)}</Text>
                  {selected && <Feather name="check" size={16} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  sheet: {
    maxHeight: "75%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  rowTextSelected: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: "600",
  },
});
