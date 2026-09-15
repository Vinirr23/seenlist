import { useMemo } from "react";
import { View, RefreshControl, Pressable, FlatList, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useTabBarClearance } from "@/lib/useTabBarClearance";
import { Screen, Text } from "@/components/ui";
import { PosterGridItem, usePosterCardWidth, POSTER_GRID_GAP } from "./PosterGrid";
import { LibraryGridSkeleton } from "./LibraryGridSkeleton";
import { EmptyShelf } from "./EmptyShelf";
import { PageError } from "./PageError";
import { colors, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-116/176 — telas "Assistir depois"/"Concluídas"/"Interrompidas"
 * (Séries), acessadas pelo botão no fim da Home. Um componente só,
 * reaproveitado pelas 3 (só muda `status`/`title`/`emptyMessage`).
 *
 * CORREÇÃO (bug real, reportado com print — pôster colado na barra
 * de navegação) — essa tela está DENTRO da aba Séries
 * (`app/(tabs)/series/watchlist.tsx` etc.), então a barra de
 * navegação (`position: absolute`) fica por cima dela igual — só que
 * essa tela nunca tinha somado `useTabBarClearance()` no
 * `paddingBottom`, diferente de toda outra tela com lista dentro de
 * uma aba (mesmo ajuste já usado em todo canto, ver
 * `useTabBarClearance.ts`).
 *
 * CORREÇÃO (a pedido — mesmo achado #3 já corrigido no Perfil) —
 * trocado `ScrollView`+`PosterGrid` (desenha tudo de uma vez, sem
 * limite) por `FlatList` virtualizada — série "Concluídas" pode
 * crescer bastante ao longo do tempo de uso.
 *
 * BUG REAL CORRIGIDO (a pedido, "verifica se ainda tem alguma
 * pendência de design", 2026-09-16) — `title`/`emptyMessage` eram
 * strings já traduzidas passadas pelos 3 chamadores
 * (`completed.tsx`/`paused.tsx`/`watchlist.tsx`), mas cada um passava
 * TEXTO FIXO em português na hora de chamar, em vez de `t(...)` — a
 * infraestrutura de tradução (`seriesHome.completedTitle`, etc.) já
 * existia em `translations.ts`, só nunca foi usada aqui. Virou
 * `titleKey`/`emptyMessageKey` (chave, não texto pronto) — a
 * tradução agora acontece DENTRO deste componente, que é o único
 * lugar com acesso a `t()` de qualquer forma. Também traduzido:
 * "Voltar" (rótulo de acessibilidade), a mensagem de erro e "Explorar
 * séries", que eram fixos direto aqui dentro.
 *
 * Comparado com o equivalente do web (`CompletedSeriesView.tsx`/
 * `PausedView.tsx`/`WatchlistView.tsx`) — nenhum dos três usa vidro
 * (sem `backdrop-blur`/gradiente nenhum, confirmado lendo o código
 * real) — então esta tela ficar sem `GlassTargetProvider`/
 * `AmbientGlow` está CORRETO, não é uma pendência.
 */
export function FilteredSeriesListScreen({
  status,
  titleKey,
  emptyMessageKey,
}: {
  status: LibraryStatus;
  titleKey: string;
  emptyMessageKey: string;
}) {
  const router = useRouter();
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();
  const cardWidth = usePosterCardWidth();
  const tabBarClearance = useTabBarClearance();
  const { t } = useTranslation();

  const filtered = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "series" && item.status === status),
    [items, status]
  );

  function handlePressItem(item: LibraryItem) {
    router.push(`/series/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable accessibilityLabel={t("common.back")} hitSlop={12} onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={20} color={colors.muted} />
        </Pressable>
        <Text variant="subtitle">{t(titleKey)}</Text>
      </View>

      {isError ? (
        <View style={styles.content}>
          <PageError message={t("seriesHome.errorLoadList")} onRetry={() => refetch()} />
        </View>
      ) : isLoading ? (
        <View style={styles.content}>
          <LibraryGridSkeleton />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.content}>
          <EmptyShelf message={t(emptyMessageKey)} actionLabel={t("seriesHome.exploreSeries")} actionHref="/(tabs)/explore" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.mediaType}-${item.id}`}
          numColumns={3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
          contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance }]}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => <PosterGridItem item={item} onPress={handlePressItem} cardWidth={cardWidth} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    // CORREÇÃO (auditoria de consistência) — faltava o `paddingTop`
    // que as outras 20 telas com cabeçalho têm: o título ficava
    // colado no topo aqui e com respiro em todo o resto do app.
    //
    // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de
    // tela em 16px app-wide) — `paddingHorizontal` era `spacing.lg`
    // (24); web usa `px-4` (`spacing.md`=16) como borda de tela.
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: 2,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  gridRow: {
    gap: POSTER_GRID_GAP,
    marginBottom: POSTER_GRID_GAP,
  },
});
