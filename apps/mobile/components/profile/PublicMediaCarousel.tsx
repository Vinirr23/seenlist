import { View, Pressable, FlatList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { LibraryItem } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * CORREÇÃO (bug real, reportado — "os cards de perfil público [...]
 * não estão com o mesmo tamanho do web", 2026-09-03, no dia seguinte
 * à criação deste componente) — herdei o valor errado de
 * `ProfileMediaCarousel.tsx` (96×144, largura fixa menor que o web) em
 * vez de conferir o tamanho real usado por `PublicMediaCarousel.tsx`
 * do WEB, que é `w-36 aspect-[2/3]` (144px de largura, proporção 2:3
 * exata → 216px de altura) — mesmo valor do `DiscoverCarousel.tsx`
 * deste app (mobile), que já estava certo. Corrigido nos dois
 * componentes ao mesmo tempo (`ProfileMediaCarousel.tsx` tinha o
 * mesmo bug, de antes desta leva — ver comentário lá).
 */
const POSTER_WIDTH = 144;

/**
 * PORTE DO WEB (2026-09-03, auditoria "implementar tudo que não
 * envolve redesign" — item "Perfil público, ordem") — o web resolveu
 * a reordenação "Séries → Séries favoritas → Filmes → Filmes
 * favoritos" reconstruindo como 4 carrosséis separados, cada um com
 * link "ver tudo" pra uma subpágina dedicada (`PublicMediaCarousel.tsx`
 * do web + `PublicMediaSectionsList.tsx`), em vez de só trocar a
 * ordem dos 2 componentes antigos (`PublicFavoritesSection.tsx`/
 * `PublicLibrarySection.tsx` — mantidos no repo, sem uso a partir de
 * agora, mesmo padrão já usado antes com `FavoriteCard.tsx`). Usuário
 * escolheu "paridade total com o web" entre as duas opções
 * apresentadas.
 *
 * Mesmo racional do comentário no web: diferente de
 * `ProfileMediaCarousel.tsx` (Perfil PRÓPRIO, que busca pôster/título
 * aos poucos a partir de uma lista de IDs, porque a própria biblioteca
 * pode ter centenas de itens sem resumo ainda carregado), aqui os
 * hooks do perfil público (`usePublicLibraryItems`/`usePublicFavorites`)
 * já devolvem os itens PRONTOS (pôster/título inclusos) — este
 * componente só recebe a lista já filtrada/ordenada por quem chama,
 * sem paginação/busca de resumo própria.
 *
 * Visual: SEM "vidro" de propósito (redesign explicitamente fora do
 * escopo desta leva) — mesmo estilo simples (fundo `colors.surface`)
 * já usado em `ProfileMediaCarousel.tsx`, não o `Glass` do
 * `DiscoverCard.tsx`/web.
 */
export function PublicMediaCarousel({
  icon,
  label,
  href,
  items,
  isLoading,
  emptyLabel,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  href: string;
  items: LibraryItem[];
  isLoading: boolean;
  /** Ausente = a seção some por completo se vazia (Séries/Filmes); só passar pra Favoritos, que mostram um convite. */
  emptyLabel?: string;
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <View style={styles.section}>
        <View style={[styles.sectionTitle, styles.sectionTitleStandalone]}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[0, 1, 2, 3, 4, 5]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={styles.row}
          renderItem={() => <View style={styles.skeleton} />}
        />
      </View>
    );
  }

  if (items.length === 0) {
    if (!emptyLabel) return null;
    return (
      <View style={styles.section}>
        <View style={[styles.sectionTitle, styles.sectionTitleStandalone]}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <Text variant="muted" style={styles.emptyText}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Pressable style={styles.sectionHeader} onPress={() => router.push(href as never)}>
        <View style={styles.sectionTitle}>
          <Feather name={icon} size={16} color={colors.primary} />
          <Text style={styles.sectionTitleText}>{label}</Text>
        </View>
        <Feather name="chevron-right" size={16} color={colors.muted} />
      </Pressable>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(item) => `${item.mediaType}-${item.id}`}
        contentContainerStyle={styles.row}
        renderItem={({ item }) => {
          const posterUrl = tmdbImageUrl(item.posterPath, "w185");
          const itemHref = item.mediaType === "movie" ? `/movies/${item.id}` : `/series/${item.id}`;
          return (
            <Pressable style={styles.poster} onPress={() => router.push(itemHref)}>
              {posterUrl ? (
                <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
              ) : (
                <View style={styles.posterPlaceholder}>
                  <Feather name="film" size={18} color={colors.muted} style={{ opacity: 0.4 }} />
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sectionTitleStandalone: {
    marginBottom: spacing.sm,
  },
  sectionTitleText: {
    fontSize: fontSize.md,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    gap: spacing.sm,
  },
  poster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterPlaceholder: {
    height: "100%",
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
});
