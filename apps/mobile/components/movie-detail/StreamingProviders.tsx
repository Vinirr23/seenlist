import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Glass } from "@/components/ui";
import { radius, spacing } from "@/lib/theme";

export function StreamingProviders({ providers }: { providers: WatchProvider[] }) {
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
              <Glass style={styles.logoWrapper} variant="medium">
                {logoUrl && <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />}
              </Glass>
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
  /**
   * PORTE DO WEB (2026-09-09) — era um retângulo SÓLIDO
   * (`colors.surface`). No `SeriesWatchProviders.tsx` do web esta caixa é vidro:
   * `border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]`
   * — a receita `medium` do `Glass` (`glassVariants` em `lib/theme.ts`:
   * desfoque 14px, brilho 0.16, base 0.09).
   *
   * O vidro fica na CAIXA DA IMAGEM mesmo, não num contêiner em volta:
   * é ela que aparece enquanto o pôster/logo carrega, ou quando não
   * existe. `backgroundColor` saiu porque quem pinta agora é o `Glass`.
   */
  logoWrapper: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
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
