import { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useProfileStats } from "@/lib/useProfileStats";
import { StatsCarousel } from "@/components/profile/StatsCarousel";
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
  const { stats, isLoading, isError } = useProfileStats();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    router.replace("/(auth)/login");
  }

  return (
    <Screen padded={false}>
      <View style={styles.topRow}>
        <View style={{ width: 24 }} />
        <Pressable onPress={() => router.push("/settings")} hitSlop={8}>
          <Feather name="settings" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Feather name="user" size={28} color={colors.primary} />
          </View>
          <Text variant="subtitle">{session?.user.email ?? "—"}</Text>
        </View>

        <View style={styles.statsWrapper}>
          <StatsCarousel stats={stats} isLoading={isLoading} isError={isError} ownerLabel="own" />
        </View>

        <View style={styles.menu}>
          <Pressable style={styles.menuRow} onPress={() => router.push("/lists")}>
            <Feather name="list" size={18} color={colors.text} />
            <Text style={styles.menuLabel}>Minhas listas</Text>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={() => router.push("/discover-people")}>
            <Feather name="user-plus" size={18} color={colors.text} />
            <Text style={styles.menuLabel}>Descobrir pessoas</Text>
            <Feather name="chevron-right" size={16} color={colors.muted} />
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Button variant="outline" onPress={handleSignOut} loading={signingOut}>
            Sair da conta
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statsWrapper: {
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
    marginTop: spacing.xl,
  },
  menu: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
});
