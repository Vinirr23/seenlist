import { useState } from "react";
import { View, FlatList, TextInput, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useUserSearch } from "@/lib/useUserSearch";
import { Screen, Text, GlassTargetProvider, Glass, AmbientGlow, ScreenHeader } from "@/components/ui";
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
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const { users, isLoading, isError, refetch } = useUserSearch(search);

  return (
    <Screen padded={false}>
      {/* CORREÇÃO (Fase 3, achado alto — ScreenHeader não chegou a esta tela) — era um cabeçalho manual, divergente das ~24 telas já convertidas na Fase 2. */}
      <ScreenHeader title={t("social.discoverPeople")} />

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
    // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.xxs` (era literal 11, mesmo valor).
    fontSize: fontSize.xxs,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});
