import { View, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Text, Glass, Skeleton } from "@/components/ui";
import { radius, spacing, fontSize } from "@/lib/theme";
import type { FavoriteGenre } from "@/lib/useFavoriteGenres";

/**
 * PORTE DO WEB (2026-09-02, reformulação completa da Explorar) —
 * versão RN de `apps/web/components/explore/GenreChips.tsx` ("Seus
 * gêneros favoritos"). Mesmo tratamento de "vidro neutro" da aba
 * inativa (`ExploreTabs.tsx`) pra cada chip.
 *
 * CORREÇÃO (2026-09-02 — "no web, explorar tem uma seta '>' e
 * infinite scroll, implementa TUDO no mobile") — voltou a ser
 * clicável, igual ao web: cada chip agora navega pra
 * `app/explore/genre/[mediaType]/[genreId].tsx`, tela nova criada
 * junto desta correção (grade paginada daquele gênero). Reverte a
 * decisão anterior deste arquivo de deixar os chips só informativos —
 * essa decisão fazia sentido enquanto a tela de destino não existia;
 * agora existe, então o chip pode voltar a fazer a MESMA coisa que
 * faz no web.
 */
export function GenreChips({
  title,
  genres,
  isLoading,
  mediaType,
}: {
  title: string;
  genres: FavoriteGenre[];
  isLoading?: boolean;
  mediaType: "movie" | "series";
}) {
  const router = useRouter();
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
            <Pressable key={genre.genreId} onPress={() => router.push(`/explore/genre/${mediaType}/${genre.genreId}` as never)}>
              <Glass style={styles.chip}>
                <Text style={styles.chipLabel}>{genre.name}</Text>
              </Glass>
            </Pressable>
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
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `paddingHorizontal` era `spacing.lg` (24) em
  // `title`/`row`. Este componente é renderizado "cru" (sem container
  // com padding) no Explorar — este `paddingHorizontal` É a borda de
  // tela.
  title: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
