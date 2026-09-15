import { useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { Glass } from "@/components/ui";
import { colors, radius, elevation } from "@/lib/theme";

/**
 * A PEDIDO (confirmação de paridade web/mobile — decisão confirmada:
 * vídeo dentro do app, não abrir no YouTube por fora) — porta de
 * `TrailerCard.tsx` do web. Web usa `<iframe>` (recurso do
 * navegador, sem equivalente nativo em React Native); aqui, o mesmo
 * resultado visual vem de um `WebView` (`react-native-webview` —
 * DEPENDÊNCIA NATIVA NOVA, precisa de `npx expo install
 * react-native-webview` + build novo, não sai só com `eas update`).
 *
 * Miniatura do YouTube (`img.youtube.com`) não precisa do WebView —
 * só a imagem estática, com botão de play por cima, igual ao web.
 * "Sem autoplay": o WebView (e o vídeo) só existe DEPOIS do toque
 * explícito — antes disso é só uma foto, nenhum custo de rede/nativo
 * a mais.
 */
export function TrailerCard({ videoKey }: { videoKey: string }) {
  const [playing, setPlaying] = useState(false);
  const thumbnailUrl = `https://img.youtube.com/vi/${videoKey}/hqdefault.jpg`;

  if (playing) {
    return (
      <View style={styles.videoWrapper}>
        <WebView
          source={{ uri: `https://www.youtube.com/embed/${videoKey}?autoplay=1&playsinline=1` }}
          style={styles.webview}
          allowsFullscreenVideo
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <Pressable onPress={() => setPlaying(true)}>
      <Glass style={styles.thumbnailWrapper} variant="medium">
        <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} contentFit="cover" />
        <View style={styles.overlay} />
        <View style={styles.playButton}>
          <Feather name="play" size={22} color={colors.background} style={styles.playIcon} />
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * PORTE DO WEB (2026-09-09) — era um retângulo SÓLIDO
   * (`colors.surface`). No `TrailerCard.tsx` do web esta caixa é vidro:
   * `border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]`
   * — a receita `medium` do `Glass` (`glassVariants` em `lib/theme.ts`:
   * desfoque 14px, brilho 0.16, base 0.09).
   *
   * O vidro fica na CAIXA DA IMAGEM mesmo, não num contêiner em volta:
   * é ela que aparece enquanto o pôster/logo carrega, ou quando não
   * existe. `backgroundColor` saiu porque quem pinta agora é o `Glass`.
   */
  thumbnailWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  playButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -28,
    marginLeft: -28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: elevation.medium.shadowColor,
    shadowOpacity: elevation.medium.shadowOpacity,
    shadowRadius: elevation.medium.shadowRadius,
    elevation: elevation.medium.elevation,
  },
  playIcon: {
    marginLeft: 3,
  },
  videoWrapper: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
});
