import { useState } from "react";
import { View, FlatList, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useUserSearch } from "@/lib/useUserSearch";
import { Screen, Text, GlassTargetProvider, Glass, AmbientGlow } from "@/components/ui";
import { PageError } from "@/components/media/PageError";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { FollowListRow } from "@/components/profile/FollowListRow";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * TASK-110 — porta de `DiscoverUsersView.tsx`. Reaproveita
 * `FollowListRow` inteiro (mesmo componente das telas Seguindo/
 * Seguidores) — só a fonte de dados muda.
 */
export default function DiscoverPeopleScreen() {
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

      {/*
        * PORTE DO WEB (2026-09-04, "vidro que falta") — mesma tela-irmã
        * de Seguindo/Seguidores (usa o MESMO `FollowListRow`, que virou
        * cartão de vidro): campo de manchas + busca de vidro, e a borda
        * de tela/respiro das linhas passou pro `contentContainerStyle`,
        * exatamente como em `app/follow-list/[userId]/[direction].tsx`.
        * Sem isso as linhas aqui ficariam coladas na borda e uma na
        * outra — a regra "mesma receita, corrigida em todo lugar".
        */}
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        <View style={styles.searchArea}>
          <Glass style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("social.searchPeople")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </Glass>
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
  searchArea: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (vira `<Glass>`); raio segue `radius.md` (web usa
  // `rounded-lg` no campo de busca, não o `rounded-2xl` dos cartões).
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  /** Borda de tela + respiro das linhas (que agora são cartões de vidro). */
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
