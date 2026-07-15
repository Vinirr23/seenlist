import { useState } from "react";
import { View, FlatList, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useFollowList } from "@/lib/useFollowList";
import type { FollowDirection } from "@/lib/followList";
import { Screen, Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { FollowListRow } from "@/components/profile/FollowListRow";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-107 — porta de `UserListPageView.tsx`: uma tela só serve as
 * duas direções (`/follow-list/[userId]/following` e `/followers`),
 * igual ao web reaproveitar o mesmo componente pras duas rotas.
 * Acessível a partir de QUALQUER perfil (não só o próprio) — tocar
 * nos números "Seguindo"/"Seguidores" em `/u/[username]` traz pra cá.
 */
export default function FollowListScreen() {
  const router = useRouter();
  const { userId: rawUserId, direction: rawDirection } = useLocalSearchParams<{ userId: string; direction: string }>();
  const userId = String(rawUserId);
  const direction = (rawDirection === "followers" ? "followers" : "following") as FollowDirection;
  const [search, setSearch] = useState("");

  const { users, isLoading, isError } = useFollowList(userId, direction, search);

  const title = direction === "following" ? "Seguindo" : "Seguidores";
  const emptyMessage = search
    ? "Nenhum resultado pra essa busca."
    : direction === "following"
      ? "Ainda não segue ninguém."
      : "Ainda não tem seguidores.";

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle" style={styles.headerTitle}>
          {title}
        </Text>
        <Pressable onPress={() => router.push("/discover-people")} hitSlop={8}>
          <Feather name="user-plus" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.searchArea}>
        <View style={styles.searchRow}>
          <Feather name="search" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Pesquisar"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>
      </View>

      {isLoading ? (
        <AvatarRowSkeleton />
      ) : isError ? (
        <Text variant="muted" style={styles.centerText}>
          Não foi possível carregar agora.
        </Text>
      ) : !users || users.length === 0 ? (
        <Text variant="muted" style={styles.centerText}>
          {emptyMessage}
        </Text>
      ) : (
        <FlatList data={users} keyExtractor={(item) => item.userId} renderItem={({ item }) => <FollowListRow user={item} />} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    flex: 1,
  },
  searchArea: {
    paddingHorizontal: spacing.lg,
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
  centerText: {
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
