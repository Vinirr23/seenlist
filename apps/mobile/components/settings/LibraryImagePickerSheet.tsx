import { useEffect, useState } from "react";
import { View, Modal, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { fetchLibraryItems, tmdbImageUrl } from "@/lib/library";
import { fetchSeriesDetails } from "@/lib/seriesDetails";
import { fetchMovieDetails } from "@/lib/movieDetails";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type Mode = "banner" | "avatar";
interface PickOption {
  key: string;
  url: string;
  label?: string;
}

/**
 * A PEDIDO (2026-09-15 — "em alterar banner, quero que apareça
 * opções de banner de séries e filmes que o usuário já marcou. em
 * alterar foto também quero que apareça opções de selecionar
 * personagens de filmes e séries que o usuário já marcou").
 *
 * Dois passos, sempre: 1) grade da biblioteca INTEIRA do usuário
 * (`fetchLibraryItems`, sem filtro de status — confirmado com o
 * usuário: "toda a biblioteca") pra escolher um título; 2) busca os
 * detalhes DESSE título só (`fetchSeriesDetails`/`fetchMovieDetails`,
 * já usados pela tela do título — nenhuma rota nova precisou ser
 * criada) e mostra as opções de verdade:
 *   - `mode="banner"`: a galeria de cenas do título (`gallery`, até 8
 *     — só séries têm; filme só tem UM backdrop, então pula direto
 *     pra ele sem grade nenhuma, não tem escolha real ali).
 *   - `mode="avatar"`: o elenco do título (`cast`, até 15), mesmo
 *     dado que já alimenta `EpisodeFavoriteCharacterPicker.tsx`
 *     (web) — só que agregado por TÍTULO escolhido, não por episódio.
 *
 * Não faz upload nenhum: a URL do TMDB (CDN pública, já é assim que
 * pôster/backdrop aparecem em todo o resto do app) vai direto pra
 * `profiles.avatar_url`/`banner_url` — ver `setBannerFromTmdb`/
 * `setAvatarFromTmdb` em `lib/imageUpload.ts`.
 */
export function LibraryImagePickerSheet({ mode, onSelect, onClose }: { mode: Mode; onSelect: (url: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<LibraryItem | null>(null);
  const [options, setOptions] = useState<PickOption[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLibraryItems()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  async function handlePickTitle(item: LibraryItem) {
    setError(null);
    setOptions(null);
    setSelectedTitle(item);
    setLoadingOptions(true);
    try {
      if (mode === "banner") {
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
      } else {
        const details = item.mediaType === "movie" ? await fetchMovieDetails(String(item.id)) : await fetchSeriesDetails(String(item.id));
        const withPhoto = details.cast.filter((member) => member.profilePath);
        if (withPhoto.length === 0) {
          setError(t("profile.libraryPickerNoCharacters"));
          setSelectedTitle(null);
        } else {
          setOptions(
            withPhoto.map((member) => ({
              key: String(member.id),
              url: tmdbImageUrl(member.profilePath, "w342") as string,
              label: member.character || member.name,
            }))
          );
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

  const title = selectedTitle
    ? mode === "banner"
      ? t("profile.libraryPickerChooseImage")
      : t("profile.libraryPickerChooseCharacter")
    : mode === "banner"
      ? t("profile.libraryPickerTitleBanner")
      : t("profile.libraryPickerTitleAvatar");

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

        {!!error && <Text variant="error" style={styles.errorText}>{error}</Text>}

        {!selectedTitle &&
          (items === null ? (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => `${item.mediaType}-${item.id}`}
              numColumns={3}
              contentContainerStyle={styles.grid}
              columnWrapperStyle={styles.gridRow}
              ListEmptyComponent={
                <Text variant="muted" style={styles.emptyText}>
                  {t("profile.libraryPickerEmpty")}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable style={styles.posterCell} onPress={() => handlePickTitle(item)}>
                  <View style={styles.posterWrapper}>
                    {item.posterPath ? (
                      <Image source={{ uri: tmdbImageUrl(item.posterPath, "w185") ?? undefined }} style={styles.poster} contentFit="cover" />
                    ) : (
                      <View style={[styles.poster, styles.posterFallback]}>
                        <Feather name={item.mediaType === "movie" ? "film" : "tv"} size={20} color={colors.muted} />
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} variant="muted" style={styles.posterTitle}>
                    {item.title}
                  </Text>
                </Pressable>
              )}
            />
          ))}

        {selectedTitle && loadingOptions && <ActivityIndicator style={styles.loading} color={colors.primary} />}

        {selectedTitle && !loadingOptions && options && mode === "avatar" && (
          <FlatList
            data={options}
            keyExtractor={(option) => option.key}
            numColumns={3}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={styles.gridRow}
            renderItem={({ item: option }) => (
              <Pressable style={styles.posterCell} onPress={() => onSelect(option.url)}>
                <Image source={{ uri: option.url }} style={styles.characterAvatar} contentFit="cover" />
                {!!option.label && (
                  <Text numberOfLines={1} variant="muted" style={styles.posterTitle}>
                    {option.label}
                  </Text>
                )}
              </Pressable>
            )}
          />
        )}

        {selectedTitle && !loadingOptions && options && mode === "banner" && (
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
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
  grid: {
    padding: spacing.md,
    gap: spacing.md,
  },
  gridRow: {
    gap: spacing.md,
  },
  posterCell: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  posterWrapper: {
    width: "100%",
    aspectRatio: 2 / 3,
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
  posterTitle: {
    fontSize: fontSize.xxs,
    textAlign: "center",
  },
  characterAvatar: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
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
