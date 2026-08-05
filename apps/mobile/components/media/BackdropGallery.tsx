import { ScrollView, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { tmdbImageUrl } from "@/lib/library";
import { colors, radius, spacing } from "@/lib/theme";

/**
 * A PEDIDO (confirmação de paridade web/mobile) — porta de
 * `BackdropGallery.tsx` do web: rolagem horizontal de fotos de cena.
 * Sem zoom, sem tela cheia — igual ao web, mesma simplicidade. Não
 * precisa de nenhuma dependência nova (é só imagem, mesmo padrão já
 * usado em `CastCarousel`/`SimilarTitlesCarousel`); dado já vem
 * junto da mesma busca que traz o resto dos detalhes, nenhuma
 * chamada de rede a mais.
 */
export function BackdropGallery({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {paths.map((path) => {
        const url = tmdbImageUrl(path, "w780");
        if (!url) return null;
        return (
          <View key={path} style={styles.item}>
            <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingBottom: 2,
  },
  item: {
    width: 160,
    height: 96,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
