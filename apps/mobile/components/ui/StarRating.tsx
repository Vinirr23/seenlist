import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

/**
 * StarRating — 5 estrelas com suporte a meio-passo (0 a 5, passo de 0.5),
 * espelhando a escala real de `reviews.rating` no banco (ver migration
 * `20260806000000_reviews_rating_0_to_5_half_step.sql`).
 *
 * Substitui o texto "★ 8,4" (escala 0-10 do TMDB) usado antes no hero da
 * tela de teste e no card de Compartilhar — a partir da rodada de
 * "geração real da frase" (2026-09-23), a nota exibida passou a ser a
 * nota que O PRÓPRIO USUÁRIO deu (decisão confirmada com o usuário, não
 * assumida), então o formato de exibição precisou mudar de número pra
 * estrelas preenchidas (referência visual que o usuário mandou:
 * estrelas cheias/meia/vazias, sem número ao lado).
 *
 * Usa `MaterialCommunityIcons` (`star` / `star-half-full` / `star-outline`)
 * em vez de tentar simular meia-estrela recortando o ícone `Feather`
 * (que não tem variante preenchida) — mais simples e sem risco de
 * desalinhamento por overflow/clip.
 */
export type StarRatingProps = {
  /** 0 a 5, qualquer valor — arredondado pro passo de 0.5 mais próximo antes de renderizar. `null` mostra as 5 vazias. */
  rating: number | null;
  size?: number;
  color?: string;
  emptyColor?: string;
  gap?: number;
};

export function StarRating({ rating, size = 14, color = "#F0A94F", emptyColor = "rgba(255,255,255,0.32)", gap = 2 }: StarRatingProps) {
  const raw = rating ?? 0;
  // Arredonda pro meio-passo mais próximo (ex.: 4.3 -> 4.5, 4.2 -> 4.0) e limita a [0, 5].
  const value = Math.max(0, Math.min(5, Math.round(raw * 2) / 2));

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fraction = value - i;
        const iconName = fraction >= 1 ? "star" : fraction >= 0.5 ? "star-half-full" : "star-outline";
        const iconColor = fraction > 0 ? color : emptyColor;
        return <MaterialCommunityIcons key={i} name={iconName} size={size} color={iconColor} />;
      })}
    </View>
  );
}
