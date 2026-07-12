import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Screen, Text, Button } from "@/components/ui";
import { colors, spacing } from "@/lib/theme";

/**
 * TASK-090 — a única aba de conteúdo com algo real nesta sessão
 * (além dos placeholders): mostra o e-mail da sessão ativa e o botão
 * de sair, pra fechar o ciclo login → abas → logout → login de
 * ponta a ponta em teste real. O resto do Perfil (avatar, estatísticas,
 * configurações, etc. — ver `apps/web/app/(main)/profile`) fica pra
 * uma tela dedicada futura.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace("/(auth)/login");
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Feather name="user" size={28} color={colors.primary} />
        </View>
        <Text variant="subtitle">{session?.user.email ?? "—"}</Text>
      </View>

      <View style={styles.footer}>
        <Button variant="outline" onPress={handleSignOut} loading={signingOut}>
          Sair da conta
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    marginTop: "auto",
    marginBottom: spacing.lg,
  },
});
