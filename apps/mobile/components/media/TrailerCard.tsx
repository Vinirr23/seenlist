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
/**
 * CAUSA RAIZ (2026-10-15, a pedido — print real, "Erro de configuração
 * do player de vídeo" / "Erro 153" ao tocar o trailer, "assistir no
 * YouTube" funcionava normal) — o `WebView` navegava DIRETO pra URL do
 * embed (`source={{ uri: "https://www.youtube.com/embed/..." }}`),
 * como se fosse abrir uma página externa. Nessa navegação direta não
 * existe nenhum documento HTML "dono" da página, então o `WebView` não
 * manda cabeçalho `Referer`/origem nenhum junto da requisição. O
 * player do YouTube valida esse referenciador contra domínios
 * autorizados pra vídeos com embed restrito (como o trailer que
 * disparou o bug) — sem ele, erro 153. "Assistir no YouTube" não passa
 * por essa checagem (é o app oficial), por isso sempre funcionava.
 *
 * Correção (mesma técnica usada por baixo dos panos em bibliotecas
 * dedicadas tipo `react-native-youtube-iframe`): em vez do WebView
 * navegar pro embed, ele carrega um documento HTML de verdade
 * (`source={{ html }}`) com um `<iframe>` do YouTube DENTRO dele, e
 * `baseUrl` com uma origem https (não precisa ser um domínio real,
 * alcançável — só precisa existir) IGUAL ao `origin` passado na URL do
 * iframe. Com isso o `WebView` passa a mandar um `Referer` consistente
 * com essa origem, que é exatamente o que faltava — resolve o erro 153
 * sem trocar de biblioteca nem precisar de build nativo novo (mesma
 * dependência `react-native-webview` de sempre).
 */
const EMBED_ORIGIN = "https://seenlist.app";

function buildEmbedHtml(videoKey: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <style>
      html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
      iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe
      src="https://www.youtube.com/embed/${videoKey}?autoplay=1&playsinline=1&origin=${EMBED_ORIGIN}"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
    ></iframe>
  </body>
</html>`;
}

export function TrailerCard({ videoKey }: { videoKey: string }) {
  const [playing, setPlaying] = useState(false);
  const thumbnailUrl = `https://img.youtube.com/vi/${videoKey}/hqdefault.jpg`;

  if (playing) {
    return (
      <View style={styles.videoWrapper}>
        <WebView
          source={{ html: buildEmbedHtml(videoKey), baseUrl: `${EMBED_ORIGIN}/` }}
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
