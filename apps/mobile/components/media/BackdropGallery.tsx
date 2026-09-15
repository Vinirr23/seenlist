import { ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { tmdbImageUrl } from "@/lib/library";
import { Glass } from "@/components/ui";
import { spacing } from "@/lib/theme";

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
          /*
            PORTE DO WEB (2026-09-09) — a caixa era um retângulo SÓLIDO
            (`colors.surface`) de canto 10. No web ela é vidro:
            `rounded-lg border border-white/10 backdrop-blur-[14px]
            backdrop-saturate-[180%]` + brilho 0.16 / base 0.09 — a
            receita `medium` do `Glass`, canto 8. O vidro fica na CAIXA
            DA IMAGEM mesmo (é ela que aparece enquanto a foto carrega),
            não num contêiner em volta.
          */
          <Glass key={path} style={styles.item} variant="medium">
            <Image source={{ uri: url }} style={styles.image} contentFit="cover" />
          </Glass>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /** `gap-2 ... pb-1` = 8 entre as fotos, 4 de folga embaixo (era 2). */
  row: {
    gap: spacing.sm,
    paddingBottom: 4,
  },
  /** `h-24 w-40 ... rounded-lg` = 160 × 96, canto 8 (era 10). */
  item: {
    width: 160,
    height: 96,
    borderRadius: 8, // `rounded-lg`
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
