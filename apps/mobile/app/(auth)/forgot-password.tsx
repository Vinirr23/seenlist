import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Screen, Text, Input, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { colors, spacing, fontSize } from "@/lib/theme";
import * as Linking from "expo-linking";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-090 — versão nativa mínima do `RequestResetForm.tsx` do web.
 * Só a metade "pedir o e-mail" foi construída agora; a outra metade
 * (`UpdatePasswordForm.tsx` — definir a senha nova a partir do link
 * recebido por e-mail) precisa de uma tela própria que trate o deep
 * link de volta pro app com uma sessão de recuperação ativa — fica
 * pra uma próxima tela dedicada, não faz parte da fundação.
 *
 * BUG REAL CORRIGIDO (a pedido, "verifica se ainda tem alguma
 * pendência de design", 2026-09-16) — ver comentário completo em
 * `login.tsx` (mesmo grupo de rotas, mesma causa raiz).
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const router = useRouter();

  async function handleRequestReset() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t("auth.emailRequired"));
      return;
    }

    setError(null);
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: Linking.createURL("auth-callback"),
    });
    setLoading(false);

    // Não revelamos se o e-mail existe ou não (evita enumeração de contas) —
    // mesma regra do web (lib/actions/auth.ts).
    if (resetError) {
      setError(t("auth.resetEmailError"));
      return;
    }
    setMessage(t("auth.resetEmailSuccess"));

    // CORREÇÃO (2026-10-21, "se o codigo de 6 digitos resolver, implanta
    // ele" — ver comentário completo em `verify-recovery-code.tsx`) —
    // além do link clicável (que continua sendo enviado e continua
    // funcionando quando chega intacto), leva a pessoa direto pra tela
    // de digitar o código de 6 dígitos, que é a alternativa que não
    // depende do link sobreviver a uma pré-varredura automática do
    // provedor de e-mail. Não substitui `auth-callback.tsx` — é só uma
    // segunda porta de entrada pro mesmo destino (`/update-password`).
    router.push({ pathname: "/(auth)/verify-recovery-code", params: { email: trimmedEmail } });
  }

  return (
    <Screen bottomInset padded={false}>
      {/* TASK-138 (correção — teclado cobrindo o campo) — mesmo motivo documentado em login.tsx. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <AuthBrand compact />

            <View>
              <Text variant="title">{t("auth.forgotPasswordTitle")}</Text>
              <Text variant="muted" style={styles.subtitle}>
                {t("auth.forgotPasswordSubtitle")}
              </Text>
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
                editable={!loading}
              />
              {!!error && <Text variant="error">{error}</Text>}
              {!!message && <Text variant="muted">{message}</Text>}
              <Button onPress={handleRequestReset} loading={loading}>
                {t("auth.sendLink")}
              </Button>
            </View>

            <Link href="/(auth)/login" style={styles.link}>
              {t("auth.backToLogin")}
            </Link>
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
  form: {
    gap: spacing.md,
  },
  link: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: "600",
    textAlign: "center",
  },
});
