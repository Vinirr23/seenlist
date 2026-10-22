import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Screen, Text, Input, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * FASE A — CORREÇÃO (2026-10-21, causa raiz real confirmada pelos Logs
 * de Autenticação do Supabase: em testes reais no iPhone, `/verify`
 * aparecia bem-sucedido ("Login") poucos segundos depois do e-mail ser
 * enviado — ANTES de qualquer toque real do usuário no link — fazendo
 * o link (de uso único) já estar consumido quando a pessoa tocava nele
 * de verdade, mesmo sendo um e-mail recém-recebido. Padrão compatível
 * com pré-varredura automática de links feita por clientes de e-mail
 * (confirmado neste caso: Gmail), fora do nosso controle via código.
 *
 * Correção: alternativa padrão da indústria pra esse problema exato —
 * em vez de depender só do link clicável, o Supabase também manda um
 * código numérico de 6 dígitos no MESMO e-mail (placeholder
 * `{{ .Token }}` no template de "Reset Password", painel do Supabase
 * → Authentication → Email Templates — precisa estar habilitado lá,
 * fora do código). Um código DIGITADO manualmente não é "clicado" por
 * nenhuma pré-varredura automática, porque nada visita link nenhum pra
 * consumi-lo — só o toque humano de verdade aciona `verifyOtp`.
 *
 * Esta tela NÃO substitui `app/auth-callback.tsx` — o link clicável
 * continua funcionando normalmente quando chega intacto (sem
 * pré-varredura no meio do caminho); esta é só uma segunda porta de
 * entrada pro mesmo destino (`/update-password`), alcançada a partir
 * de `(auth)/forgot-password.tsx` logo depois do pedido de e-mail —
 * useful principalmente quando o link falhar com "inválido/expirado"
 * mesmo sendo novo.
 *
 * `verifyOtp({ type: "recovery" })` estabelece sessão da MESMA forma
 * que `exchangeCodeForSession`/`setSession` em `auth-callback.tsx` —
 * o evento `PASSWORD_RECOVERY` do Supabase (que `AuthProvider.tsx`
 * escuta) é uma propriedade do próprio token, não do método usado pra
 * trocá-lo por sessão (ver comentário em `AuthProvider.tsx`), então
 * `isPasswordRecovery` é marcado certinho aqui também, sem precisar de
 * nenhuma mudança no AuthProvider.
 */
export default function VerifyRecoveryCodeScreen() {
  const router = useRouter();
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const { t } = useTranslation();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const email = typeof emailParam === "string" ? emailParam : Array.isArray(emailParam) ? emailParam[0] ?? "" : "";

  async function handleVerify() {
    const trimmedCode = code.trim();
    if (!email || !trimmedCode) {
      setError(t("auth.invalidRecoveryCode"));
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: trimmedCode,
      type: "recovery",
    });
    setLoading(false);

    if (verifyError) {
      // Mesma regra de segurança do resto do fluxo (ver forgot-password.tsx):
      // nunca expõe a mensagem técnica do Supabase, só uma genérica.
      setError(t("auth.invalidRecoveryCode"));
      return;
    }

    router.replace("/update-password");
  }

  async function handleResend() {
    if (!email) return;

    setError(null);
    setMessage(null);
    setResending(true);
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
    setResending(false);

    if (resendError) {
      setError(t("auth.resetEmailError"));
      return;
    }
    setMessage(t("auth.codeResent"));
  }

  return (
    <Screen bottomInset padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <AuthBrand compact />

            <View>
              <Text variant="title">{t("auth.recoveryCodeTitle")}</Text>
              <Text variant="muted" style={styles.subtitle}>
                {t("auth.recoveryCodeSubtitle", { email })}
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label={t("auth.recoveryCodeLabel")}
                placeholder={t("auth.recoveryCodePlaceholder")}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                value={code}
                onChangeText={setCode}
                editable={!loading}
              />
              {!!error && <Text variant="error">{error}</Text>}
              {!!message && <Text variant="muted">{message}</Text>}
              <Button onPress={handleVerify} loading={loading}>
                {t("auth.verifyCode")}
              </Button>
              <Button variant="outline" onPress={handleResend} loading={resending}>
                {t("auth.resendCode")}
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
