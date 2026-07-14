import { useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems } from "@/lib/useLibraryItems";
import { useViewModePreference } from "@/lib/useViewModePreference";
import { Screen, Text } from "@/components/ui";
import { PosterGrid } from "@/components/media/PosterGrid";
import { MediaListRow } from "@/components/media/MediaListRow";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { EmptyShelf } from "@/components/media/EmptyShelf";
import { HomeTabs, type HomeTab } from "@/components/media/HomeTabs";
import { colors, spacing } from "@/lib/theme";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function isReleased(releaseDate: string | null | undefined, todayKey: string): boolean {
  if (!releaseDate) return true; // sem data conhecida — trata como já lançado, mesmo padrão de "year: null" já usado no resto do app.
  return releaseDate <= todayKey;
}

function upcomingLabel(releaseDate: string, todayKey: string): string {
  const today = new Date(`${todayKey}T00:00:00`);
  const target = new Date(`${releaseDate}T00:00:00`);
  const daysUntil = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (daysUntil === 0) return "Estreia hoje";
  if (daysUntil === 1) return "Estreia amanhã";
  if (daysUntil <= 30) return `Estreia em ${daysUntil} dias`;
  return `Estreia em ${DATE_FORMATTER.format(target)}`;
}

/**
 * TASK-099 (correção — pedido do usuário) — tirei a categoria
 * "Assistindo" daqui. Diferente do web (que mantém as 3 categorias
 * lado a lado), a decisão pra este app é que filme não tem estado
 * "assistindo" que faça sentido mostrar como lista — só série tem
 * episódios/progresso pra acompanhar aos poucos. Filme é "quero
 * assistir" ou já foi assistido (o que muda o status pra "completed"
 * automaticamente, some daqui). Também removi o título "Filmes" no
 * topo — a barra de abas embaixo já diz em qual tela você está.
 *
 * TASK-148 (a pedido — diverge do web de propósito) — "Em breve" pro
 * web é um placeholder intencional (não existe conceito recorrente
 * de "próximo lançamento" pra filme, diferente de série). A pedido,
 * construído aqui mesmo assim: filme "Assistir depois" com data de
 * lançamento no futuro sai de "Assistir depois" e vai pra "Em breve"
 * automaticamente — sem precisar de nada manual.
 */
export default function MoviesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<HomeTab>("minha-lista");
  const { items, isLoading, isError, refreshing, refetch } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("movies-library");

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const allWantToWatch = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "movie" && item.status === "want_to_watch"),
    [items]
  );

  const wantToWatch = useMemo(() => allWantToWatch.filter((item) => isReleased(item.releaseDate, todayKey)), [allWantToWatch, todayKey]);

  const upcoming = useMemo(
    () =>
      allWantToWatch
        .filter((item) => !isReleased(item.releaseDate, todayKey))
        .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? "")),
    [allWantToWatch, todayKey]
  );

  function handlePressItem(item: LibraryItem) {
    router.push(`/movies/${item.id}`);
  }

  return (
    <Screen padded={false}>
      <View style={styles.tabsRow}>
        <HomeTabs active={tab} onChange={setTab} />
      </View>

      {tab === "minha-lista" ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">Assistir depois</Text>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

          {isError ? (
            <EmptyShelf message="Não foi possível carregar sua biblioteca agora. Tente de novo em instantes." />
          ) : isLoading ? (
            <Text variant="muted">Carregando…</Text>
          ) : wantToWatch.length === 0 ? (
            <EmptyShelf message="Sua lista está vazia." actionLabel="Explorar filmes" actionHref="/(tabs)/explore" />
          ) : viewMode === "grid" ? (
            <PosterGrid items={wantToWatch} onPressItem={handlePressItem} />
          ) : (
            <View style={styles.listRows}>
              {wantToWatch.map((item) => (
                <MediaListRow key={item.id} item={item} onPress={handlePressItem} secondaryText={item.year ? String(item.year) : ""} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} tintColor={colors.primary} />}
        >
          <View style={styles.sectionHeader}>
            <Text variant="subtitle">Em breve</Text>
            <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
          </View>

          {isError ? (
            <EmptyShelf message="Não foi possível carregar sua biblioteca agora. Tente de novo em instantes." />
          ) : isLoading ? (
            <Text variant="muted">Carregando…</Text>
          ) : upcoming.length === 0 ? (
            <EmptyShelf message="Nenhum filme da sua lista 'Assistir depois' tem estreia futura conhecida." />
          ) : viewMode === "grid" ? (
            <PosterGrid items={upcoming} onPressItem={handlePressItem} />
          ) : (
            <View style={styles.listRows}>
              {upcoming.map((item) => (
                <MediaListRow
                  key={item.id}
                  item={item}
                  onPress={handlePressItem}
                  secondaryText={item.releaseDate ? upcomingLabel(item.releaseDate, todayKey) : ""}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    paddingTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  listRows: {
    gap: spacing.sm,
  },
});
