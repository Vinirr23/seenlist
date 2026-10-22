import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text, Input, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * FASE A (recuperação de senha) — equivalente nativo de
 * `apps/web/app/(auth)/forgot-password/UpdatePasswordForm.tsx`. Só
 * alcançável depois de `app/auth-callback.tsx` estabelecer uma sessão
 * de recuperação com sucesso (`type === "recovery"`) — não existe link
 * direto de navegação pra cá de nenhum outro lugar do app.
 *
 * Ao salvar com sucesso, chama `completePasswordRecovery()` (ver
 * `AuthProvider.tsx`) ANTES de navegar — libera a navegação normal de
 * novo (sem isso, `index.tsx` continuaria tratando a sessão como
 * "recuperação pendente" indefinidamente) — e só então volta pro app
 * já autenticado, sem exigir login de novo (mesmo comportamento do
 * fluxo web).
 */
export default function UpdatePasswordScreen() {
  const router = useRouter();
  const { completePasswordRecovery } = useAuth();
  const { t } = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setError(null);

    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordsDontMatch"));
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      // Mesma mensagem genérica do web (`lib/actions/auth.ts`,
      // `updatePassword`) — não expõe detalhe técnico do Supabase.
      setError(t("auth.updatePasswordError"));
      return;
    }

    completePasswordRecovery();
    router.replace("/(tabs)/series");
  }

  return (
    <Screen bottomInset padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <AuthBrand compact />

            <View>
              <Text variant="title">{t("auth.setNewPassword")}</Text>
              <Text variant="muted" style={styles.subtitle}>
                {t("auth.chooseNewPassword")}
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label={t("auth.password")}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <Input
                label={t("auth.confirmPassword")}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
              />
              {!!error && <Text variant="error">{error}</Text>}
              <Button onPress={handleSave} loading={loading}>
                {t("auth.savePassword")}
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  content: {
    gap: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
});
