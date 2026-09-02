import { View, ScrollView, StyleSheet } from "react-native";
import { Text, Glass, Skeleton } from "@/components/ui";
import { radius, spacing, fontSize } from "@/lib/theme";
import type { FavoriteGenre } from "@/lib/useFavoriteGenres";

/**
 * PORTE DO WEB (2026-09-02, reformulação completa da Explorar) —
 * versão RN de `apps/web/components/explore/GenreChips.tsx` ("Seus
 * gêneros favoritos"). Mesmo tratamento de "vidro neutro" da aba
 * inativa (`ExploreTabs.tsx`) pra cada chip.
 *
 * DIFERENÇA DELIBERADA do web: lá cada chip é um link pra
 * `/explore/genre/[mediaType]/[genreId]` (listagem completa daquele
 * gênero). O mobile hoje NÃO tem nenhuma tela de destino desse tipo —
 * confirmado por varredura completa de `app/(tabs)`: nem "ver todos"
 * de carrossel, nem tela de gênero/similares existem no app nativo
 * ainda (todo carrossel mobile, incluindo `DiscoverCarousel.tsx`, já
 * é só visual, sem link "ver mais" nenhum). Construir essas telas
 * novas não fazia parte do pedido ("a reformulação completa da
 * Explorar" = igualar o CONTEÚDO/estrutura já existente no web, não
 * inventar navegação nova) — os chips aqui são só INFORMATIVOS
 * (mostram os gêneros, sem toque), mesmo padrão "sem destino" já
 * usado no resto do Explorar mobile.
 */
export function GenreChips({
  title,
  genres,
  isLoading,
}: {
  title: string;
  genres: FavoriteGenre[];
  isLoading?: boolean;
}) {
  if (!isLoading && genres.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={styles.title}>
        {title}
      </Text>

      {isLoading ? (
        <View style={styles.row}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={80} height={32} borderRadius={radius.full} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {genres.map((genre) => (
            <Glass key={genre.genreId} style={styles.chip}>
              <Text style={styles.chipLabel}>{genre.name}</Text>
            </Glass>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  title: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
