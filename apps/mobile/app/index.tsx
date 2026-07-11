import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { WebView, type WebViewNavigation } from "react-native-webview";

const SITE_URL = "https://seenlist.app";
const BACKGROUND_COLOR = "#0B0E14"; // mesma cor de apps/mobile/app.json (backgroundColor) — evita flash branco antes do site carregar.

/**
 * TASK-068 — "opção 1" combinada com o usuário: em vez de recriar
 * cada tela do site em React Native do zero (trabalho grande, feito
 * aos poucos depois), o app mobile agora é uma casca nativa que
 * carrega o site de verdade (seenlist.app) dentro de uma WebView em
 * tela cheia. Todo o trabalho já feito no site (tradução, comentário
 * com imagem, tela de episódio nova, etc.) já funciona aqui, no
 * mesmo dia, sem duplicar nada.
 *
 * `sharedCookiesEnabled`/`thirdPartyCookiesEnabled` — login (email/
 * senha e Google) usa cookies de sessão do Supabase; sem isso, cada
 * vez que o app fosse reaberto a pessoa precisaria logar de novo.
 *
 * Botão físico de "voltar" do Android: se a WebView tem histórico
 * pra voltar (`canGoBack`), volta dentro do site — só deixa o
 * Android fechar o app se já estiver na primeira página.
 *
 * Notificações push (`lib/pushNotifications.ts`, preparado na
 * TASK-052) NÃO estão conectadas aqui — login agora acontece dentro
 * do site carregado (sessão via cookie), não no cliente Supabase
 * nativo do app (`lib/supabase.ts`), que é quem essa peça precisa
 * pra saber "logado como quem". Conectar isso exigiria uma ponte
 * site→app (`postMessage`) avisando quando o login acontece — fica
 * pra quando o app nativo de verdade for construído, não faz sentido
 * só pra essa casca.
 */
export default function RootScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (canGoBack) {
          webViewRef.current?.goBack();
          return true;
        }
        return false; // deixa o Android tratar normalmente (minimizar/fechar o app)
      });
      return () => subscription.remove();
    }, [canGoBack])
  );

  function handleNavigationStateChange(navState: WebViewNavigation) {
    setCanGoBack(navState.canGoBack);
  }

  function handleRetry() {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <WebView
        ref={webViewRef}
        source={{ uri: SITE_URL }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setHasError(true);
        }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        startInLoadingState={false}
        allowsBackForwardNavigationGestures
      />

      {loading && !hasError && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#F5A623" />
        </View>
      )}

      {hasError && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>Não foi possível carregar o SeenList agora.</Text>
          <Pressable onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Tentar de novo</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  webview: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BACKGROUND_COLOR,
    padding: 24,
    gap: 16,
  },
  errorText: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#F5A623",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#0B0E14",
    fontSize: 14,
    fontWeight: "700",
  },
});
