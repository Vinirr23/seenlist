import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useNotificationPreferences } from "@/lib/useNotificationPreferences";
import type { NotificationPreferences } from "@/lib/notificationPreferences";
import { Screen, Text, Skeleton } from "@/components/ui";
import { ToggleRow } from "@/components/settings/ToggleRow";
import { colors, radius, spacing } from "@/lib/theme";

const ITEMS: { field: keyof NotificationPreferences; label: string }[] = [
  { field: "episodeNew", label: "Novo episódio" },
  { field: "seasonPremiere", label: "Nova temporada" },
  { field: "commentReply", label: "Respostas aos meus comentários" },
  { field: "commentLike", label: "Curtidas em comentários" },
  { field: "reviewLike", label: "Curtidas em reviews" },
];

/**
 * TASK-114 — porta de `NotificationPreferencesView.tsx`. Só
 * preferências (o que a pessoa quer ou não receber) — o ENVIO de
 * verdade mora nas Edge Functions/triggers do Supabase, não aqui;
 * o app só liga/desliga os interruptores que essas rotinas
 * consultam antes de mandar.
 */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { preferences, isLoading, savingField, setField } = useNotificationPreferences();

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Notificações</Text>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.card}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={styles.skeletonRow}>
                <Skeleton width="55%" height={14} />
                <Skeleton width={40} height={22} borderRadius={11} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            {ITEMS.map((item, index) => (
              <ToggleRow
                key={item.field}
                label={item.label}
                value={preferences[item.field]}
                disabled={savingField === item.field}
                onChange={(value) => setField(item.field, value)}
                last={index === ITEMS.length - 1}
              />
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
