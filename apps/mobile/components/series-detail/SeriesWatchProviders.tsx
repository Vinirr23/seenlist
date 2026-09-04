import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * IMPLEMENTAÇÃO (2026-09-04, a pedido — "quais implementações faltam
 * pro mobile") — "onde assistir" nunca tinha sido ligado à tela de
 * Série do mobile. O dado (`SeriesDetails.watchProviders`) já vinha
 * pronto da mesma rota `/api/tmdb/series/[id]` usada pelo web desde
 * 2026-08-25 (ver comentário em `packages/types/src/index.ts`) — só
 * faltava a parte visual, que nunca tinha sido criada aqui.
 *
 * Cópia de `movie-detail/StreamingProviders.tsx` (mesmo padrão visual,
 * mesmo componente-fonte que o web usa pros dois — `movie/
 * StreamingProviders.tsx` e `series/SeriesWatchProviders.tsx` também
 * são dois arquivos quase idênticos lá), num arquivo próprio em
 * `series-detail/` seguindo a mesma separação por tela que o resto
 * deste app já usa (`SeriesHeader.tsx`, `SeriesCaughtUpCard.tsx` etc.
 * ficam em `series-detail/`, nunca em `movie-detail/`).
 *
 * Texto "Onde assistir" fixo (não usa `t()`) de propósito — mantém a
 * MESMA condição que já existia em `movie-detail/StreamingProviders.tsx`
 * antes desta mudança (também sem tradução). Tradução ficou combinada
 * como pendência separada, pra não misturar os dois escopos.
 */
export function SeriesWatchProviders({ providers }: { providers: WatchProvider[] }) {
  if (providers.length === 0) return null;

  return (
    <View>
      <Text variant="subtitle" style={styles.title}>
        Onde assistir
      </Text>
      <View style={styles.row}>
        {providers.map((provider) => {
          const logoUrl = tmdbImageUrl(provider.logoPath, "w185");
          return (
            <View key={provider.id} style={styles.item}>
              <View style={styles.logoWrapper}>
                {logoUrl && <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />}
              </View>
              <Text numberOfLines={1} variant="muted" style={styles.name}>
                {provider.name}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  item: {
    width: 56,
    alignItems: "center",
    gap: 4,
  },
  logoWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  name: {
    fontSize: 10,
    textAlign: "center",
  },
});
