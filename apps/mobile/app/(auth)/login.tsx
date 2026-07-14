import { useState } from "react";
import { View, Image, KeyboardAvoidingView, ScrollView, Platform, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text, Input, Button } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();

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
            <View style={styles.brand}>
              <Image source={require("@/assets/images/logo.png")} style={styles.logo} />
              <Text variant="title" style={styles.brandName}>
                SeenList
              </Text>
            </View>

            <View>
              <Text variant="title">Entrar</Text>
              <Text variant="muted" style={styles.subtitle}>
                Acesse sua conta do SeenList.
              </Text>
            </View>

            <Button variant="outline" onPress={handleGoogleLogin} loading={googleLoading} disabled={busy && !googleLoading}>
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
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
              />
              {!!error && <Text variant="error">{error}</Text>}
              <Button onPress={handleEmailLogin} loading={loading} disabled={busy && !loading}>
                Entrar
              </Button>
            </View>

            <View style={styles.footerRow}>
              <Link href="/(auth)/forgot-password" style={styles.mutedLink}>
                Esqueceu a senha?
              </Link>
              <Link href="/(auth)/register" style={styles.primaryLink}>
                Criar conta
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
  brand: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
  },
  brandName: {
    marginTop: spacing.sm,
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
    fontSize: 14,
  },
  primaryLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
