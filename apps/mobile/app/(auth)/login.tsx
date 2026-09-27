import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet, Image } from "react-native";
import { Link, useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text, Input, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { colors, spacing, fontSize, radius } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * PARIDADE COM O WEB (2026-09-22, reportado — "porque o do Google não
 * tem esse destaque com símbolo também?") — o botão da Apple usa o
 * componente NATIVO oficial (`AppleAuthenticationButton`, já vem com
 * logo embutido); o do Google aqui nunca teve o logo do
 * `GoogleButton.tsx` do web (`<GoogleIcon />`, SVG de 4 cores) — só o
 * texto foi portado. PNG estático (não `react-native-svg`) de
 * propósito: `react-native-svg` é dependência nativa nova, exigiria
 * gerar build novo pra funcionar; um PNG é só asset, entra até por
 * `eas update`. Mesmas cores oficiais do Google (`#4285F4`/`#34A853`/
 * `#FBBC05`/`#EA4335`), gerado a partir do MESMO path SVG do web.
 */
const GOOGLE_ICON = require("../../assets/images/google-icon.png");

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
  const { signInWithEmail, signInWithGoogle, signInWithApple } = useAuth();
  const { t } = useTranslation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

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

  /** REQUISITO DA APP STORE (2026-09-22) — ver comentário grande em `AuthProvider.tsx`, `signInWithApple`. */
  async function handleAppleLogin() {
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

            {/*
              REQUISITO DA APP STORE (2026-09-22, rejeição real —
              Guideline 4.8) — botão NATIVO da Apple (não o `Button`
              genérico do app): a própria Apple exige o componente
              oficial (`AppleAuthenticationButton`), com aparência e
              proeminência já dentro das regras deles — desenhar um
              botão "parecido" à mão é desaconselhado pela documentação
              deles. Só em iOS (não existe em Android); tamanho igual ao
              `Button` (`minHeight: 48`, `radius.md`) pra ficar alinhado
              visualmente com o de Google logo abaixo.
            */}
            {Platform.OS === "ios" && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={radius.md}
                style={[styles.appleButton, busy && !appleLoading && styles.appleButtonDisabled]}
                /**
                 * BUG REAL CORRIGIDO (achado por `npx tsc --noEmit`,
                 * 2026-09-22) — antes era
                 * `onPress={busy && !appleLoading ? undefined : handleAppleLogin}`.
                 * Erro de tipo, não estilo: `onPress` do
                 * `AppleAuthenticationButton` é `() => void`
                 * OBRIGATÓRIO (`expo-apple-authentication`, ao
                 * contrário do `Button` próprio do app, que aceita
                 * `onPress` opcional) — passar `undefined` pra
                 * "desabilitar" o toque nunca deveria ter compilado.
                 * A `style` já disabled (opacity 0.5) deixava
                 * parecer que funcionava. Correção pela raiz: sempre
                 * passa uma função; o "desabilitado" vira um early
                 * return DENTRO dela, não a ausência da prop.
                 */
                onPress={() => {
                  if (busy && !appleLoading) return;
                  handleAppleLogin();
                }}
              />
            )}

            <Button
              variant="outline"
              onPress={handleGoogleLogin}
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
  /** Mesma altura mínima do `Button` (`minHeight: 48`) — ver comentário no JSX. */
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
