import { useEffect, useState } from "react";
import { View, Image as RNImage, StyleSheet } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { colors, radius, spacing } from "@/lib/theme";

const MAX_HEIGHT = 420; // teto de altura, mesmo espírito do "max-h-96" do web — só corta se a imagem for muito mais alta que larga.
const MIN_HEIGHT = 120;

/**
 * TASK-155/156 (correção — imagem cortada, e GIF sem animar) —
 * reaproveitada em qualquer lugar que mostra uma imagem enviada por
 * usuário (post, comentário) — antes, cada lugar tinha sua própria
 * altura FIXA, forçando toda imagem pro mesmo formato de caixa,
 * cortando (`resizeMode="cover"`) qualquer imagem que não coubesse
 * nessa proporção exata. O web nunca fez isso — usa a altura NATURAL
 * da imagem (respeitando a proporção real), só com um teto máximo
 * (corta apenas se a imagem for excepcionalmente alta).
 * `RNImage.getSize` busca as dimensões reais da imagem, calcula a
 * altura que ela teria na largura disponível, e só aplica o teto
 * quando realmente precisa.
 *
 * Correção (TASK-156 — GIF não animava): o `Image` padrão do React
 * Native não anima GIF de forma confiável no Android sem
 * configuração nativa extra (problema conhecido, documentado pela
 * própria comunidade Expo/RN) — por isso troquei a EXIBIÇÃO pro
 * `expo-image` (pacote da própria Expo, feito pra isso, já usado
 * como padrão recomendado). `RNImage.getSize` continua sendo usado
 * só pra medir a imagem — isso não depende de qual componente
 * desenha ela depois.
 */
export function AdaptiveImage({ uri, maxHeight = MAX_HEIGHT }: { uri: string; maxHeight?: number }) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    RNImage.getSize(
      uri,
      (width, height) => {
        if (!cancelled && height > 0) setAspectRatio(width / height);
      },
      (error) => console.error("[AdaptiveImage] Falha ao ler dimensões da imagem", error)
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const naturalHeight = containerWidth > 0 && aspectRatio ? containerWidth / aspectRatio : maxHeight;
  const displayHeight = Math.min(Math.max(naturalHeight, MIN_HEIGHT), maxHeight);

  return (
    <View style={styles.wrapper} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ExpoImage source={{ uri }} style={[styles.image, { height: displayHeight }]} contentFit="cover" autoplay />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: spacing.sm,
    width: "100%",
  },
  image: {
    width: "100%",
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
});
