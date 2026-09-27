import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet, Image } from "react-native";
import { Link, useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text, Input, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/** PARIDADE COM O WEB (2026-09-22) — ver comentário completo em `login.tsx` (mesmo grupo de rotas, mesma causa raiz). */
const GOOGLE_ICON = require("../../assets/images/google-icon.png");

/**
 * BUG REAL CORRIGIDO (a pedido, "verifica se ainda tem alguma
 * pendência de design", 2026-09-16) — ver comentário completo em
 * `login.tsx` (mesmo grupo de rotas, mesma causa raiz).
 */
export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    setMessage(null);
    setLoading(true);
    const result = await signUpWithEmail(email, password, confirmPassword);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.message) {
      setMessage(result.message);
      return;
    }
    router.replace("/(tabs)/series");
  }

  async function handleGoogleSignUp() {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    setGoogleLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace("/(tabs)/series");
  }

  /** REQUISITO DA APP STORE (2026-09-22) — ver comentário grande em `AuthProvider.tsx`, `signInWithApple`, e em `login.tsx`. */
  async function handleAppleSignUp() {
    setError(null);
    setAppleLoading(true);
    const result = await signInWithApple();
    setAppleLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace("/(tabs)/series");
  }

  const busy = loading || googleLoading || appleLoading;

  return (
    <Screen bottomInset padded={false}>
      {/* TASK-138 (correção — teclado cobrindo o campo) — mesmo motivo documentado em login.tsx. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <AuthBrand compact />

            <View>
              <Text variant="title">{t("auth.createAccount")}</Text>
              <Text variant="muted" style={styles.subtitle}>
                {t("auth.registerSubtitle")}
              </Text>
            </View>

            {/* REQUISITO DA APP STORE (2026-09-22) — ver comentário grande no mesmo lugar em `login.tsx`. */}
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.md}
                style={[styles.appleButton, busy && !appleLoading && styles.appleButtonDisabled]}
                // BUG REAL CORRIGIDO (achado por `npx tsc --noEmit`, 2026-09-22) — ver comentário completo no mesmo lugar em `login.tsx`, mesma causa raiz (`onPress` de `AppleAuthenticationButton` é obrigatório, `undefined` nunca deveria ter compilado).
                onPress={() => {
                  if (busy && !appleLoading) return;
                  handleAppleSignUp();
                }}
              />
            )}

            <Button
              variant="outline"
              onPress={handleGoogleSignUp}
              loading={googleLoading}
              disabled={busy && !googleLoading}
              icon={<Image source={GOOGLE_ICON} style={styles.googleIcon} />}
            >
              {t("auth.continueWithGoogle")}
            </Button>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text variant="muted">{t("auth.or")}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.form}>
              <Input
                label={t("auth.email")}
                placeholder={t("auth.emailPlaceholder")}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                editable={!busy}
              />
              <Input
                label={t("auth.password")}
                placeholder={t("auth.passwordMinChars")}
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />
              <Input
                label={t("auth.confirmPassword")}
                placeholder={t("auth.repeatPassword")}
                secureTextEntry
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!busy}
              />
              {!!error && <Text variant="error">{error}</Text>}
              {!!message && <Text variant="muted">{message}</Text>}
              <Button onPress={handleSignUp} loading={loading} disabled={busy && !loading}>
                {t("auth.createAccount")}
              </Button>
            </View>

            <View style={styles.footerRowCenter}>
              <Text variant="muted">{t("auth.alreadyHaveAccount")}</Text>
              <Link href="/(auth)/login" style={styles.primaryLink}>
                {t("auth.signIn")}
              </Link>
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  // `content.gap` NÃO foi tocado — é o espaçamento vertical entre
  // campos do formulário, não borda de tela; fora do escopo.
  content: {
    gap: spacing.lg,
  },
  /** Mesma altura mínima do `Button` (`minHeight: 48`) — ver `login.tsx`. */
  appleButton: {
    height: 48,
  },
  appleButtonDisabled: {
    opacity: 0.5,
  },
  /** Mesmo tamanho (16px) do `<GoogleIcon />` do web. */
  googleIcon: {
    width: 16,
    height: 16,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  form: {
    gap: spacing.md,
  },
  footerRowCenter: {
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryLink: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
