import { useState } from "react";
import { View, FlatList, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useUserSearch } from "@/lib/useUserSearch";
import { Screen, Text } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { FollowListRow } from "@/components/profile/FollowListRow";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-110 — porta de `DiscoverUsersView.tsx`. Reaproveita
 * `FollowListRow` inteiro (mesmo componente das telas Seguindo/
 * Seguidores) — só a fonte de dados muda.
 */
export default function DiscoverPeopleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { users, isLoading, isError, refetch } = useUserSearch(search);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">{t("social.discoverPeople")}</Text>
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("social.searchPeople")}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>
      </View>

      {!search && !isLoading && users && users.length > 0 && (
        <Text variant="muted" style={styles.suggestionsLabel}>
          {t("social.suggestions")}
        </Text>
      )}

      {isLoading ? (
        <AvatarRowSkeleton />
      ) : isError ? (
        <PageError message={t("error.loadGeneric")} onRetry={() => refetch()} />
      ) : !users || users.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          {t("social.noSearchResults")}
        </Text>
      ) : (
        <FlatList data={users} keyExtractor={(item) => item.userId} renderItem={({ item }) => <FollowListRow user={item} />} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  searchArea: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  // CORREÇÃO (2026-09-03) — mesma padronização de borda de tela.
  suggestionsLabel: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
