import { View, StyleSheet } from "react-native";
import { useNotificationPreferences } from "@/lib/useNotificationPreferences";
import type { NotificationPreferences } from "@/lib/notificationPreferences";
import { Screen, Skeleton, GlassTargetProvider, Glass, AmbientGlow, ScreenHeader } from "@/components/ui";
import { ToggleRow } from "@/components/settings/ToggleRow";
import { colors, radius, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-114 — porta de `NotificationPreferencesView.tsx`. Só
 * preferências (o que a pessoa quer ou não receber) — o ENVIO de
 * verdade mora nas Edge Functions/triggers do Supabase, não aqui;
 * o app só liga/desliga os interruptores que essas rotinas
 * consultam antes de mandar.
 */
export default function NotificationSettingsScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela.
   */
  const espacoDoDock = useTabBarClearance();
  const { t } = useTranslation();
  const ITEMS: { field: keyof NotificationPreferences; label: string }[] = [
    { field: "episodeNew", label: t("settings.notifEpisodeNew") },
    { field: "seasonPremiere", label: t("settings.notifSeasonPremiere") },
    { field: "commentReply", label: t("settings.notifCommentReply") },
    { field: "commentLike", label: t("settings.notifCommentLike") },
    { field: "reviewLike", label: t("settings.notifReviewLike") },
  ];
  const { preferences, isLoading, savingField, setField } = useNotificationPreferences();

  return (
    <Screen padded={false}>
      {/* CORREÇÃO (Fase 3, achado alto — ScreenHeader não chegou a esta tela) — era um cabeçalho manual, divergente das ~24 telas já convertidas na Fase 2. */}
      <ScreenHeader title={t("settings.notifications")} />

      {/*
        * PORTE DO WEB (2026-09-04, "vidro que falta") —
        * `NotificationPreferencesView.tsx` não tem campo de manchas
        * próprio (nenhuma tela sozinha tem uma paleta dedicada aqui,
        * diferente de Configurações/Perfil) — usa o `AmbientGlow`
        * padrão do app (âmbar/teal), igual a qualquer outra tela sem
        * paleta própria.
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow />}>
      <View style={[styles.content, { paddingBottom: espacoDoDock }]}>
        {isLoading ? (
          <Glass style={styles.card}>
            {[0, 1, 2, 3].map((index) => (
              <View key={index} style={styles.skeletonRow}>
                <Skeleton width="55%" height={14} />
                <Skeleton width={40} height={22} borderRadius={11} />
              </View>
            ))}
          </Glass>
        ) : (
          <Glass style={styles.card}>
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
          </Glass>
        )}
      </View>
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.md,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (vira `<Glass>`, mesma borda `border-white/10` de antes).
  card: {
    borderRadius: radius.md,
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
