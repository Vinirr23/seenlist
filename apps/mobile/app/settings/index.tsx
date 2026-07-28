import { useEffect, useState } from "react";
import { ScrollView, View, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { fetchMyProfileSettings, type MyProfileSettings, type ProfileVisibility } from "@/lib/settings";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Screen, Text } from "@/components/ui";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { VisibilityRow } from "@/components/settings/VisibilityRow";
import { LanguageRow } from "@/components/settings/LanguageRow";
import { ChangePasswordModal } from "@/components/settings/ChangePasswordModal";
import { colors, radius, spacing } from "@/lib/theme";

const SITE_URL = "https://seenlist.app";

/**
 * TASK-104 — porta de `SettingsPage.tsx` do web, com o que já se
 * aplica ao app nativo hoje. De propósito, fora desta leva original:
 *
 * - Tema — o nativo só tem tema escuro por enquanto, sem opção de
 *   trocar ainda.
 * - Notificações — já ligado (leva TASK-114): registro de push,
 *   deep link ao tocar, e esta tela agora tem o link de verdade pra
 *   `/settings/notifications`.
 * - Migrar do TV Time — ferramenta de importação única, faz sentido
 *   só no site (upload de arquivo), não no app.
 * - Editar perfil (nome/foto/bio) — a parte de TEXTO já existe
 *   (`/settings/edit-profile`, leva TASK-105); só falta trocar
 *   foto/banner, que depende de seletor de imagem.
 * - Excluir conta — abre o navegador pro site em vez de reimplementar
 *   aqui. É uma operação que mexe com a conta inteira (Supabase Auth
 *   Admin, chave de serviço) — o site já tem isso pronto e testado;
 *   duplicar essa lógica sensível no cliente nativo é risco sem
 *   necessidade real.
 *
 * Adicionado numa leva posterior: Idioma (`LanguageRow`, sistema de
 * tradução pt-BR/en/es construído do zero pro app nativo, mesma
 * arquitetura do web).
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<MyProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    fetchMyProfileSettings()
      .then(setProfile)
      .finally(() => setIsLoading(false));
  }, []);

  function updateLocalVisibility(field: "profileVisibility" | "favoritesVisibility" | "libraryVisibility", value: ProfileVisibility) {
    setProfile((current) => (current ? { ...current, [field]: value } : current));
  }

  function handleDeleteAccount() {
    Alert.alert(
      t("settings.deleteAccount"),
      t("settings.deleteAccountMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("settings.openSite"), onPress: () => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings`) },
      ]
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/(auth)/login");
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("settings.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isLoading && profile && (
          <>
            <SectionLabel label={t("settings.section.account")} />
            <View style={styles.card}>
              <SettingsRow label={t("auth.email")} value={profile.email ?? "—"} />
              <View style={styles.uidRow}>
                <Text variant="label">{t("settings.accountId")}</Text>
                <TextInput value={profile.userId} editable={false} style={styles.uidInput} />
              </View>
              <SettingsRow label={t("settings.password")} value="••••••••" onPress={() => setShowPasswordModal(true)} last />
            </View>

            <SectionLabel label={t("settings.section.privacy")} />
            <View style={styles.card}>
              <VisibilityRow
                label={t("nav.profile")}
                field="profileVisibility"
                value={profile.profileVisibility}
                onChanged={(v) => updateLocalVisibility("profileVisibility", v)}
              />
              <VisibilityRow
                label={t("settings.library")}
                field="libraryVisibility"
                value={profile.libraryVisibility}
                onChanged={(v) => updateLocalVisibility("libraryVisibility", v)}
              />
              <VisibilityRow
                label={t("settings.favorites")}
                field="favoritesVisibility"
                value={profile.favoritesVisibility}
                onChanged={(v) => updateLocalVisibility("favoritesVisibility", v)}
                last
              />
            </View>
          </>
        )}

        <SectionLabel label={t("settings.section.preferences")} />
        <View style={styles.card}>
          <LanguageRow />
          <SettingsRow label={t("settings.notifications")} onPress={() => router.push("/settings/notifications")} last />
        </View>

        {/* TASK-171/172 — abre a versão web numa aba dentro do app (mesmo `WebBrowser` já usado pra Sobre/Privacidade/Termos), em vez de reconstruir OAuth e parser de .zip nativo no mobile — os dois já escrevem no mesmo Supabase que o mobile lê, então o resultado aparece aqui na volta, sem duplicar nada. */}
        <SectionLabel label={t("settings.section.importData")} />
        <View style={styles.card}>
          <SettingsRow label={t("settings.importFromTrakt")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/import/trakt`)} />
          <SettingsRow label={t("settings.migrateFromTvTime")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/import/tvtime`)} last />
        </View>

        <SectionLabel label={t("settings.section.app")} />
        <View style={styles.card}>
          <SettingsRow label={t("settings.sendFeedback")} onPress={() => router.push("/settings/feedback")} />
          <SettingsRow label={t("settings.about")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/about`)} />
          <SettingsRow label={t("settings.privacyPolicy")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/privacy`)} />
          <SettingsRow label={t("settings.termsOfUse")} onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/terms`)} last />
        </View>

        <SectionLabel label={t("settings.section.dangerZone")} />
        <View style={styles.card}>
          <SettingsRow label={t("settings.deleteAccount")} danger onPress={handleDeleteAccount} last />
        </View>

        <Pressable style={styles.logoutButton} onPress={handleSignOut}>
          <Feather name="log-out" size={16} color={colors.danger} />
          <Text style={styles.logoutText}>{t("settings.signOut")}</Text>
        </Pressable>
      </ScrollView>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </Screen>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <Text variant="muted" style={styles.sectionLabel}>
      {label.toUpperCase()}
    </Text>
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
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  uidRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 4,
  },
  uidInput: {
    fontSize: 12,
    color: colors.muted,
    padding: 0,
  },
  logoutButton: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.danger,
  },
});
