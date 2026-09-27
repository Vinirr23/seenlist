import { useEffect, useMemo, useState } from "react";
import { View, Modal, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { fetchLibraryItems, tmdbImageUrl } from "@/lib/library";
import { fetchSeriesDetails } from "@/lib/seriesDetails";
import { fetchMovieDetails } from "@/lib/movieDetails";
import { textoCasaComBusca } from "@/lib/fuzzyMatch";
import { Text, GlassTargetProvider, AmbientGlow, Glass, PressableScale } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";

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
 *
 * CORREÇÃO (a pedido, 2026-09-27, print do iPhone real — "essas 2
 * telas, não receberam glass e o botão não está com o padrão do
 * app") — CAUSA RAIZ: este componente foi criado em 2026-09-15, ANTES
 * do sistema de glass (`Glass.tsx`, ver
 * `SEENLIST-SISTEMA-VIDRO-WEB-2026-09-04.md`) ter sido retrofitado
 * nas sub-telas do app — nunca chegou a ser atualizado depois.
 * Corrigido pra bater com o padrão de `CountryPicker.tsx`/
 * `ScreenHeader.tsx`: corpo do modal envolto em `GlassTargetProvider`
 * + `AmbientGlow` (mesmos `SUBPAGE_GLOW_BLOBS` das outras sub-páginas,
 * `lib/glowBlobs.ts`), e os botões do header (seta/X) viram
 * `Glass variant="icon"` (36×36, `borderRadius: 18` — mesmo padrão do
 * botão circular sobre imagem usado em `CountryPicker`/`u/[username]`)
 * dentro de `PressableScale`, no lugar do `Pressable` cru sem nenhum
 * fundo.
 */
export function LibraryImagePickerSheet({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const { t, locale } = useTranslation();
  /**
   * CAUSA RAIZ (2026-09-24, a pedido — "a seta/o X estão muito lá em
   * cima, dificultando de usar") — este componente usa <Modal> nativo
   * direto (não a rota do expo-router, nem o <Screen> compartilhado
   * do resto do app), então NUNCA recebia a área segura do topo
   * (status bar / notch / Dynamic Island): styles.header tinha um
   * paddingTop: spacing.lg FIXO (24px), enquanto o inset real de
   * topo passa de 44-59px na maioria dos iPhones modernos — por isso o
   * botão (seta OU X, mesmo header pros dois passos "Escolher um
   * título"/"Escolher uma cena") ficava sobreposto/perto demais da
   * barra de status.
   *
   * Fix: useSafeAreaInsets() (MESMO padrão do <Screen> — NUNCA usar
   * <SafeAreaView> nativo, já travou o app com SIGSEGV nesta base de
   * código antes, ver comentário em Screen.tsx) + insets.top somado
   * ao respiro visual que já existia (spacing.sm), no lugar do
   * spacing.lg fixo.
   */
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<LibraryItem | null>(null);
  const [options, setOptions] = useState<PickOption[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * CORREÇÃO (a pedido, 2026-09-27 — "eu estou usando idioma inglês e
   * apareceu a lista toda em português") — CAUSA RAIZ: `fetchLibraryItems()`
   * era chamado SEM argumentos, então sempre caía no default fixo
   * ("pt-BR") do parâmetro de idioma, ignorando o idioma que o usuário
   * de fato tem selecionado no app — diferente do padrão já correto
   * usado em `useLibraryItems.ts`, que sempre passa o `locale` atual.
   * Corrigido pra passar `locale` (de `useTranslation()`) e recarregar
   * sempre que ele mudar.
   */
  useEffect(() => {
    fetchLibraryItems(undefined, locale)
      .then(setItems)
      .catch(() => setItems([]));
  }, [locale]);

  /*
   * CORREÇÃO (a pedido, 2026-09-27 — "quero que a pesquisa funcione
   * independente de idioma e mesmo com erro de digitação") — antes,
   * `item.title.toLowerCase().includes(query)`: exigia substring EXATA
   * (com acento certo) só do título já localizado (pt-BR aqui). Trocado
   * por `textoCasaComBusca` (lib/fuzzyMatch.ts) — ignora acento/caixa e
   * tolera pequenos erros de digitação por palavra.
   *
   * "Independente de idioma" bate também contra `item.originalTitle`
   * (título original da TMDB) — chegou a existir aqui uma versão que
   * buscava esse título item por item, em segundo plano
   * (`fetchMovieDetails`/`fetchSeriesDetails`), mas achado real numa
   * Biblioteca de 1428 itens mostrou que isso não escala (teto de 80
   * buscas deixava a maioria — inclusive séries inteiras — sem título
   * original, busca falhando em silêncio). Resolvido na RAIZ: o título
   * original agora vem pronto na própria busca em lote da Biblioteca —
   * `getMovieSummary`/`getSeriesSummary` (`apps/web/lib/tmdb/client.ts`)
   * já buscam o resumo de cada item, e a TMDB já devolve
   * `original_title`/`original_name` de graça NESSA MESMA resposta;
   * agora é gravado em `media_summaries_cache` (migração
   * `20260927000000_media_summaries_cache_original_title.sql`) e
   * propagado até `LibraryItem.originalTitle` (packages/types) — zero
   * chamada nova, funciona pra biblioteca de qualquer tamanho.
   */
  const filteredItems = useMemo(() => {
    if (!items) return items;
    const query = search.trim();
    if (!query) return items;
    return items.filter((item) => textoCasaComBusca(item.title, query) || textoCasaComBusca(item.originalTitle ?? "", query));
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
      <GlassTargetProvider style={styles.container} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <PressableScale hitSlop={8} onPress={selectedTitle ? handleBack : onClose}>
            <Glass variant="icon" style={styles.headerButton}>
              <Feather name={selectedTitle ? "arrow-left" : "x"} size={16} color={colors.text} />
            </Glass>
          </PressableScale>
          <Text variant="subtitle" numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          <View style={styles.headerButton} />
        </View>

        {!selectedTitle && (
          /*
           * CORREÇÃO (a pedido, 2026-09-27, print comparando com a busca
           * do Explorar — "faltou só o glass na search bar de banner") —
           * CAUSA RAIZ: mesma categoria dos outros dois bugs desta leva
           * (a tela toda nunca tinha sido retrofitada com o sistema de
           * vidro, ver comentário no topo do componente): essa barra
           * usava `<View>` com `backgroundColor: colors.surface` chapado,
           * enquanto a barra de busca do Explorar (`SearchBar.tsx`) já é
           * `<Glass>` (variant padrão "card") desde 2026-09-04. Trocado
           * pro mesmo padrão — `backgroundColor` chapado saiu do estilo
           * (o `Glass` cuida do próprio fundo/blur).
           */
          <Glass style={styles.searchRow}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("profile.libraryPickerSearchPlaceholder")}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </Glass>
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

        {/*
          * CORREÇÃO (a pedido, 2026-09-16, com print de referência —
          * "o sheet de selecionar banner deve ficar assim como nesses
          * prints") — era uma grade de 2 colunas; a referência mostra
          * uma LISTA de 1 coluna só, cada cena ocupando a largura
          * inteira, rolando verticalmente. Trocado pra bater com a
          * referência.
          */}
        {selectedTitle && !loadingOptions && options && (
          <FlatList
            data={options}
            keyExtractor={(option) => option.key}
            contentContainerStyle={styles.optionList}
            renderItem={({ item: option }) => (
              <Pressable style={styles.bannerCell} onPress={() => onSelect(option.url)}>
                <Image source={{ uri: option.url }} style={styles.bannerImage} contentFit="cover" />
              </Pressable>
            )}
          />
        )}
      </GlassTargetProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    // paddingTop saiu daqui — virou dinâmico (insets.top + spacing.sm) no <View>, ver comentário no componente acima.
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
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
  optionList: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bannerCell: {
    width: "100%",
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
