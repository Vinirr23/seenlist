import { useEffect, useMemo, useState } from "react";
import { View, Modal, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { fetchLibraryItems, tmdbImageUrl } from "@/lib/library";
import { fetchSeriesDetails } from "@/lib/seriesDetails";
import { fetchMovieDetails } from "@/lib/movieDetails";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

interface PickOption {
  key: string;
  url: string;
}

/**
 * A PEDIDO (2026-09-15 — "em alterar banner, quero que apareça
 * opções de banner de séries e filmes que o usuário já marcou").
 *
 * Dois passos: 1) lista com busca — CORREÇÃO (a pedido, com print de
 * referência, "quero que apareça um sheet igual esse aí, com opção
 * pra procurar por nome, e em lista") — mesmo padrão visual do
 * seletor nativo de foto de capa que o usuário mandou de exemplo:
 * pôster pequeno + título + tipo (ícone + "Série"/"Filme") + seta, um
 * por linha, com campo de busca fixo no topo (mesmo padrão de
 * `CountryPicker.tsx` — filtra local, sem chamada nova nenhuma, já
 * que `fetchLibraryItems` busca tudo de uma vez). 2) busca os
 * detalhes DESSE título só (`fetchSeriesDetails`/`fetchMovieDetails`,
 * já usados pela tela do título — nenhuma rota nova precisou ser
 * criada) e mostra a galeria de cenas do título (`gallery`, até 8 —
 * só séries têm; filme só tem UM backdrop, então pula direto pra ele
 * sem grade nenhuma, não tem escolha real ali), em GRADE (faz sentido
 * visual — são imagens pra comparar lado a lado, não uma lista de
 * nomes).
 *
 * SIMPLIFICADO (a pedido, 2026-09-15, mesma leva — "na escolha de
 * avatar deixa pra a pessoa selecionar do celular como estava antes.
 * ... a mudança do sheet com opções, fica só no banner") — este
 * componente chegou a suportar `mode="avatar"` (elenco do título)
 * também, mas o usuário reverteu o avatar pro seletor de galeria do
 * aparelho puro e simples — esse modo nunca chegou a ser usado de
 * verdade fora desta tela, removido daqui (fica só banner). Se um dia
 * precisar de novo, `git log` desta leva tem o código.
 *
 * Não faz upload nenhum: a URL do TMDB (CDN pública, já é assim que
 * pôster/backdrop aparecem em todo o resto do app) vai direto pra
 * `profiles.banner_url` — ver `setBannerFromTmdb` em
 * `lib/imageUpload.ts`.
 */
export function LibraryImagePickerSheet({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<LibraryItem | null>(null);
  const [options, setOptions] = useState<PickOption[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLibraryItems()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const filteredItems = useMemo(() => {
    if (!items) return items;
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.title.toLowerCase().includes(query));
  }, [items, search]);

  async function handlePickTitle(item: LibraryItem) {
    setError(null);
    setOptions(null);
    setSelectedTitle(item);
    setLoadingOptions(true);
    try {
      if (item.mediaType === "movie") {
        // Filme só tem UM backdrop no TMDB — não existe "escolher entre vários" aqui, aplica direto.
        const details = await fetchMovieDetails(String(item.id));
        if (details.backdropPath) {
          onSelect(tmdbImageUrl(details.backdropPath, "w780") as string);
          return;
        }
        setError(t("profile.libraryPickerNoImages"));
        setSelectedTitle(null);
      } else {
        const details = await fetchSeriesDetails(String(item.id));
        const paths = details.gallery.length > 0 ? details.gallery : details.backdropPath ? [details.backdropPath] : [];
        if (paths.length === 0) {
          setError(t("profile.libraryPickerNoImages"));
          setSelectedTitle(null);
        } else {
          setOptions(paths.map((path, index) => ({ key: `${path}-${index}`, url: tmdbImageUrl(path, "w780") as string })));
        }
      }
    } catch (err) {
      console.error("[LibraryImagePickerSheet] Falha ao buscar detalhes do título", err);
      setError(t("error.generic"));
      setSelectedTitle(null);
    } finally {
      setLoadingOptions(false);
    }
  }

  function handleBack() {
    setSelectedTitle(null);
    setOptions(null);
    setError(null);
  }

  const title = selectedTitle ? t("profile.libraryPickerChooseImage") : t("profile.libraryPickerTitleBanner");

  return (
    <Modal visible animationType="slide" onRequestClose={selectedTitle ? handleBack : onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={selectedTitle ? handleBack : onClose} hitSlop={8} style={styles.headerButton}>
            <Feather name={selectedTitle ? "arrow-left" : "x"} size={20} color={colors.text} />
          </Pressable>
          <Text variant="subtitle" numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          <View style={styles.headerButton} />
        </View>

        {!selectedTitle && (
          <View style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("profile.libraryPickerSearchPlaceholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
        )}

        {!!error && <Text variant="error" style={styles.errorText}>{error}</Text>}

        {!selectedTitle &&
          (items === null ? (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          ) : (
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => `${item.mediaType}-${item.id}`}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text variant="muted" style={styles.emptyText}>
                  {search.trim() ? t("profile.libraryPickerNoResults") : t("profile.libraryPickerEmpty")}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => handlePickTitle(item)}>
                  <View style={styles.posterWrapper}>
                    {item.posterPath ? (
                      <Image source={{ uri: tmdbImageUrl(item.posterPath, "w185") ?? undefined }} style={styles.poster} contentFit="cover" />
                    ) : (
                      <View style={[styles.poster, styles.posterFallback]}>
                        <Feather name={item.mediaType === "movie" ? "film" : "tv"} size={16} color={colors.muted} />
                      </View>
                    )}
                  </View>
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={styles.rowTitle}>
                      {item.title}
                    </Text>
                    <View style={styles.rowSubtitle}>
                      <Feather name={item.mediaType === "movie" ? "film" : "tv"} size={12} color={colors.muted} />
                      <Text variant="muted" style={styles.rowSubtitleText}>
                        {item.mediaType === "movie" ? t("media.movie") : t("media.series")}
                      </Text>
                    </View>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.muted} />
                </Pressable>
              )}
            />
          ))}

        {selectedTitle && loadingOptions && <ActivityIndicator style={styles.loading} color={colors.primary} />}

        {selectedTitle && !loadingOptions && options && (
          <FlatList
            data={options}
            keyExtractor={(option) => option.key}
            numColumns={2}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item: option }) => (
              <Pressable style={styles.bannerCell} onPress={() => onSelect(option.url)}>
                <Image source={{ uri: option.url }} style={styles.bannerImage} contentFit="cover" />
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerButton: {
    width: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  errorText: {
    textAlign: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  loading: {
    marginTop: spacing.xl,
  },
  emptyText: {
    textAlign: "center",
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  posterWrapper: {
    width: 44,
    height: 64,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  posterFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  rowSubtitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowSubtitleText: {
    fontSize: fontSize.xxs,
  },
  grid: {
    padding: spacing.md,
    gap: spacing.md,
  },
  gridRow: {
    gap: spacing.md,
  },
  bannerCell: {
    flex: 1,
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
});
