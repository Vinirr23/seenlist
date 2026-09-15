import { useState } from "react";
import { View, FlatList, TextInput, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useFollowList } from "@/lib/useFollowList";
import type { FollowDirection } from "@/lib/followList";
import { Screen, Text, GlassTargetProvider, Glass, AmbientGlow } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { FollowListRow } from "@/components/profile/FollowListRow";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-107 — porta de `UserListPageView.tsx`: uma tela só serve as
 * duas direções (`/follow-list/[userId]/following` e `/followers`),
 * igual ao web reaproveitar o mesmo componente pras duas rotas.
 * Acessível a partir de QUALQUER perfil (não só o próprio) — tocar
 * nos números "Seguindo"/"Seguidores" em `/u/[username]` traz pra cá.
 */
export default function FollowListScreen() {
  /*
   * A BARRA DE NAVEGAÇÃO AGORA APARECE NESTA TELA TAMBÉM (2026-09-09,
   * decisão do usuário) — ela subiu pro layout raiz (`app/_layout.tsx`),
   * como no web. Sendo `position: absolute`, ela não reserva espaço
   * sozinha: sem esta folga no fim do conteúdo, o último item ficaria
   * atrás dela. Mesma conta que as telas de aba já usavam.
   */
  const espacoDoDock = useTabBarClearance();
  const router = useRouter();
  const { t } = useTranslation();
  const { userId: rawUserId, direction: rawDirection } = useLocalSearchParams<{ userId: string; direction: string }>();
  const userId = String(rawUserId);
  const direction = (rawDirection === "followers" ? "followers" : "following") as FollowDirection;
  const [search, setSearch] = useState("");

  const { users, isLoading, isError, refetch } = useFollowList(userId, direction, search);

  const title = direction === "following" ? t("profile.following") : t("profile.followers");
  const emptyMessage = search
    ? t("social.noSearchResults")
    : direction === "following"
      ? t("profile.notFollowingAnyone")
      : t("profile.noFollowersYet");

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

      {/* PORTE DO WEB (2026-09-04, "vidro que falta") — campo de manchas de `UserListPageView.tsx` (ver `lib/glowBlobs.ts`). */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        <View style={styles.searchArea}>
          {/*
            * PORTE DO WEB (2026-09-04) — a caixa de busca vira vidro
            * (web: "mesmo padrão do campo de busca do SearchBar.tsx");
            * o `TextInput` por dentro continua transparente — campo de
            * formulário não recebe vidro.
            */}
          <Glass style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("common.search")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </Glass>
        </View>

        {isLoading ? (
          <AvatarRowSkeleton />
        ) : isError ? (
          <PageError message={t("error.loadGeneric")} onRetry={() => refetch()} />
        ) : !users || users.length === 0 ? (
          <Text variant="muted" style={styles.centerText}>
            {emptyMessage}
          </Text>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.userId}
            renderItem={({ item }) => <FollowListRow user={item} />}
            contentContainerStyle={[styles.listContent, { paddingBottom: espacoDoDock }]}
          />
        )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
  },
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
  headerTitle: {
    flex: 1,
  },
  // CORREÇÃO (2026-09-03) — mesma padronização de borda de tela.
  searchArea: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (vira `<Glass>`). Raio mantido em `radius.md`: o web usa
  // `rounded-lg` aqui (8px, campo de busca), não o `rounded-2xl` das
  // linhas — não são a mesma peça.
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  /**
   * A borda de tela das linhas mora aqui agora (antes era o
   * `paddingHorizontal` de dentro do `FollowListRow`, que virou cartão
   * de vidro) — mais o respiro entre cartões, que a linha crua não
   * precisava ter.
   */
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  // CORREÇÃO (2026-09-03) — mesma padronização de borda de tela.
  centerText: {
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
