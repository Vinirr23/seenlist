import { useEffect, useState } from "react";
import { ScrollView, View, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Feather } from "@expo/vector-icons";
import { fetchMyProfileSettings, type MyProfileSettings, type ProfileVisibility } from "@/lib/settings";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text } from "@/components/ui";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { VisibilityRow } from "@/components/settings/VisibilityRow";
import { ChangePasswordModal } from "@/components/settings/ChangePasswordModal";
import { colors, radius, spacing } from "@/lib/theme";

const SITE_URL = "https://seenlist.app";

/**
 * TASK-104 — porta de `SettingsPage.tsx` do web, com o que já se
 * aplica ao app nativo hoje. De propósito, fora desta leva:
 *
 * - Idioma/Tema — o nativo só tem português e tema escuro por
 *   enquanto, nenhuma das duas opções existe ainda pra trocar.
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
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
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
      "Excluir conta",
      "Isso abre o site do SeenList, onde você pode concluir a exclusão da sua conta (é uma ação permanente, feita lá por segurança).",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Abrir site", onPress: () => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings`) },
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
        <Text variant="subtitle">Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!isLoading && profile && (
          <>
            <SectionLabel label="Conta" />
            <View style={styles.card}>
              <SettingsRow label="E-mail" value={profile.email ?? "—"} />
              <View style={styles.uidRow}>
                <Text variant="label">ID da conta</Text>
                <TextInput value={profile.userId} editable={false} style={styles.uidInput} />
              </View>
              <SettingsRow label="Senha" value="••••••••" onPress={() => setShowPasswordModal(true)} last />
            </View>

            <SectionLabel label="Privacidade" />
            <View style={styles.card}>
              <VisibilityRow
                label="Perfil"
                field="profileVisibility"
                value={profile.profileVisibility}
                onChanged={(v) => updateLocalVisibility("profileVisibility", v)}
              />
              <VisibilityRow
                label="Biblioteca"
                field="libraryVisibility"
                value={profile.libraryVisibility}
                onChanged={(v) => updateLocalVisibility("libraryVisibility", v)}
              />
              <VisibilityRow
                label="Favoritos"
                field="favoritesVisibility"
                value={profile.favoritesVisibility}
                onChanged={(v) => updateLocalVisibility("favoritesVisibility", v)}
                last
              />
            </View>
          </>
        )}

        <SectionLabel label="Preferências" />
        <View style={styles.card}>
          <SettingsRow label="Notificações" onPress={() => router.push("/settings/notifications")} last />
        </View>

        <SectionLabel label="Aplicativo" />
        <View style={styles.card}>
          <SettingsRow label="Enviar feedback" onPress={() => router.push("/settings/feedback")} />
          <SettingsRow label="Sobre" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/about`)} />
          <SettingsRow label="Política de privacidade" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/privacy`)} />
          <SettingsRow label="Termos de uso" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/profile/settings/terms`)} last />
        </View>

        <SectionLabel label="Zona de risco" />
        <View style={styles.card}>
          <SettingsRow label="Excluir conta" danger onPress={handleDeleteAccount} last />
        </View>

        <Pressable style={styles.logoutButton} onPress={handleSignOut}>
          <Feather name="log-out" size={16} color={colors.danger} />
          <Text style={styles.logoutText}>Sair da conta</Text>
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
