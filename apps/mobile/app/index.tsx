import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { WebView, type WebViewNavigation } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";

const SITE_URL = "https://seenlist.app";
const BACKGROUND_COLOR = "#0B0E14"; // mesma cor de apps/mobile/app.json (backgroundColor) — evita flash branco antes do site carregar.
const AUTH_BRIDGE_SCHEME_URL = "seenlist://auth-bridge";

/**
 * TASK-079 — marcador só pra `signInWithGoogle` (no site) reconhecer
 * que a requisição veio de dentro do app, não de um navegador comum
 * — sem isso não tem como saber quando mandar de volta pro esquema
 * customizado (`seenlist://auth-bridge`) em vez do redirect normal
 * dentro do próprio navegador. `Platform.OS` mantido no final pra não
 * perder a informação de plataforma que o WebView normalmente inclui.
 */
const USER_AGENT_SUFFIX = ` SeenListApp/1.0 (${Platform.OS})`;

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
 * senha) usa cookies de sessão do Supabase; sem isso, cada vez que o
 * app fosse reaberto a pessoa precisaria logar de novo.
 *
 * Botão físico de "voltar" do Android: se a WebView tem histórico
 * pra voltar (`canGoBack`), volta dentro do site — só deixa o
 * Android fechar o app se já estiver na primeira página.
 *
 * TASK-079 — login com Google precisou de um desvio: o Google
 * bloqueia esse login (erro "disallowed_useragent") dentro de
 * QUALQUER WebView genérica, a nossa incluída — não é um bug nosso,
 * é a política de segurança do próprio Google desde 2021.
 * `onShouldStartLoadWithRequest` intercepta a navegação assim que ela
 * tenta ir pra `accounts.google.com` (cancela dentro da WebView,
 * `return false`) e abre esse mesmo endereço numa aba de navegador
 * externa de verdade (`WebBrowser.openAuthSessionAsync` — Custom
 * Tabs no Android, que o Google aceita). Quando o login termina lá
 * fora, o site (`/auth/callback`, ver route.ts) redireciona de volta
 * pro esquema customizado do app (`seenlist://auth-bridge`) carregando
 * os tokens da sessão — só então a WebView interna é navegada pra
 * `/auth/mobile-bridge`, que usa esses tokens pra logar ELA mesma
 * (a aba externa e a WebView interna não compartilham sessão entre
 * si, por isso essa ponte com tokens é necessária, não dá pra confiar
 * em cookie compartilhado aqui).
 *
 * Notificações push (`lib/pushNotifications.ts`, preparado na
 * TASK-052) ainda NÃO estão conectadas — precisariam do cliente
 * Supabase nativo (`lib/supabase.ts`) também autenticado, o que a
 * ponte acima não faz (só loga a WebView) — fica pra quando o app
 * nativo de verdade for construído.
 */
export default function RootScreen() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const insets = useSafeAreaInsets();

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

  /**
   * TASK-079 — só intercepta `accounts.google.com` (o domínio da
   * tela de login do Google em si); qualquer outra navegação segue
   * normal dentro da WebView, `return true`.
   */
  function handleShouldStartLoadWithRequest(request: { url: string }): boolean {
    let host = "";
    try {
      host = new URL(request.url).hostname;
    } catch {
      return true;
    }
    if (host !== "accounts.google.com") return true;

    void (async () => {
      const result = await WebBrowser.openAuthSessionAsync(request.url, AUTH_BRIDGE_SCHEME_URL);
      if (result.type !== "success" || !result.url) return;

      const tokens = new URL(result.url).searchParams;
      const accessToken = tokens.get("access_token");
      const refreshToken = tokens.get("refresh_token");
      if (!accessToken || !refreshToken) return;

      webViewRef.current?.injectJavaScript(
        `window.location.href = ${JSON.stringify(
          `${SITE_URL}/auth/mobile-bridge?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`
        )}; true;`
      );
    })();

    return false; // cancela dentro da WebView — só a aba externa segue com o login
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: SITE_URL }}
        style={styles.webview}
        applicationNameForUserAgent={USER_AGENT_SUFFIX}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
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
    </View>
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
