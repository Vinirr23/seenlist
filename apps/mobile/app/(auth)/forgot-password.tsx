import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Screen, Text, Input, Button } from "@/components/ui";
import { AuthBrand } from "@/components/auth/AuthBrand";
import { colors, spacing, fontSize } from "@/lib/theme";
import * as Linking from "expo-linking";

/**
 * TASK-090 — versão nativa mínima do `RequestResetForm.tsx` do web.
 * Só a metade "pedir o e-mail" foi construída agora; a outra metade
 * (`UpdatePasswordForm.tsx` — definir a senha nova a partir do link
 * recebido por e-mail) precisa de uma tela própria que trate o deep
 * link de volta pro app com uma sessão de recuperação ativa — fica
 * pra uma próxima tela dedicada, não faz parte da fundação.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestReset() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Informe seu e-mail.");
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
      setError("Não foi possível enviar o e-mail agora. Tente de novo em instantes.");
      return;
    }
    setMessage("Se esse e-mail tiver conta, enviamos um link de recuperação.");
  }

  return (
    <Screen bottomInset padded={false}>
      {/* TASK-138 (correção — teclado cobrindo o campo) — mesmo motivo documentado em login.tsx. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <AuthBrand compact />

            <View>
              <Text variant="title">Esqueceu a senha?</Text>
              <Text variant="muted" style={styles.subtitle}>
                Enviamos um link de recuperação pro seu e-mail.
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="E-mail"
                placeholder="voce@exemplo.com"
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
                Enviar link
              </Button>
            </View>

            <Link href="/(auth)/login" style={styles.link}>
              Voltar pro login
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
