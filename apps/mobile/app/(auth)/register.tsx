import { useState } from "react";
import { View, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text, Input, Button } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const busy = loading || googleLoading;

  return (
    <Screen bottomInset padded={false}>
      {/* TASK-138 (correção — teclado cobrindo o campo) — mesmo motivo documentado em login.tsx. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View>
              <Text variant="title">Criar conta</Text>
              <Text variant="muted" style={styles.subtitle}>
                Leva menos de um minuto.
              </Text>
            </View>

            <Button variant="outline" onPress={handleGoogleSignUp} loading={googleLoading} disabled={busy && !googleLoading}>
              Continuar com Google
            </Button>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text variant="muted">ou</Text>
              <View style={styles.dividerLine} />
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
                editable={!busy}
              />
              <Input
                label="Senha"
                placeholder="Mínimo 8 caracteres"
                secureTextEntry
                autoComplete="new-password"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />
              <Input
                label="Confirmar senha"
                placeholder="Repita a senha"
                secureTextEntry
                autoComplete="new-password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!busy}
              />
              {!!error && <Text variant="error">{error}</Text>}
              {!!message && <Text variant="muted">{message}</Text>}
              <Button onPress={handleSignUp} loading={loading} disabled={busy && !loading}>
                Criar conta
              </Button>
            </View>

            <View style={styles.footerRowCenter}>
              <Text variant="muted">Já tem conta? </Text>
              <Link href="/(auth)/login" style={styles.primaryLink}>
                Entrar
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
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
  footerRowCenter: {
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
