import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text, Input, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * BUG REAL CORRIGIDO (a pedido, "verifica se ainda tem alguma
 * pendência de design", 2026-09-16) — esta tela nunca teve NENHUM
 * `t()` — todo texto era fixo em português (título, placeholders,
 * botões, links), mesmo com as chaves `auth.*` já existindo em
 * `translations.ts` prontas pra uso (achado real: infraestrutura de
 * tradução pronta, só nunca foi ligada aqui). Mesma correção em
 * `register.tsx`/`forgot-password.tsx` (mesmo grupo de rotas).
 */
export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleEmailLogin() {
    setError(null);
    setLoading(true);
    const result = await signInWithEmail(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace("/(tabs)/series");
  }

  async function handleGoogleLogin() {
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

  const busy = loading || googleLoading;

  return (
    <Screen bottomInset padded={false}>
      {/* TASK-138 (correção — teclado cobrindo o campo de senha) — Screen é só um View comum, sem nenhum ajuste de teclado embutido; sem isso, o teclado simplesmente cobre o que estiver embaixo dele. "height" no Android pelo mesmo motivo já documentado em CreatePostButton.tsx ("padding" tem comportamento inconsistente); ScrollView garante que dá pra rolar até o fim mesmo com o teclado ocupando espaço. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <AuthBrand />

            <View>
              <Text variant="title">{t("auth.signIn")}</Text>
              <Text variant="muted" style={styles.subtitle}>
                {t("auth.signInSubtitle")}
              </Text>
            </View>

            <Button variant="outline" onPress={handleGoogleLogin} loading={googleLoading} disabled={busy && !googleLoading}>
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
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />
              {!!error && <Text variant="error">{error}</Text>}
              <Button onPress={handleEmailLogin} loading={loading} disabled={busy && !loading}>
                {t("auth.signIn")}
              </Button>
            </View>

            <View style={styles.footerRow}>
              <Link href="/(auth)/forgot-password" style={styles.mutedLink}>
                {t("auth.forgotPassword")}
              </Link>
              <Link href="/(auth)/register" style={styles.primaryLink}>
                {t("auth.createAccount")}
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  mutedLink: {
    color: colors.muted,
    fontSize: fontSize.sm,
  },
  primaryLink: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
});
