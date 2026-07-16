import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { colors } from "@/lib/theme";

const SPLASH_DURATION_MS = 3000;

/**
 * TASK-165 (splash, retomada) — sem isso, a splash NATIVA (a que o
 * Android mostra sozinho, configurada em app.json) some assim que o
 * JavaScript termina de montar o primeiro componente — em aparelhos
 * rápidos isso pode ser rápido demais pra dar tempo de ver, do jeito
 * que o usuário percebeu. `preventAutoHideAsync()` (chamado aqui, no
 * escopo do módulo — precisa rodar antes de qualquer render) avisa o
 * sistema pra NÃO esconder a splash sozinho; a gente esconde na mão
 * com `hideAsync()` depois de 3 segundos garantidos, não importa
 * quão rápido o JS tenha carregado. Esse timer é independente do
 * `loading` do `useAuth()` em `app/index.tsx` — mesmo que a sessão
 * resolva em 100ms, a splash nativa continua cobrindo a tela até
 * completar os 3s (a tela de destino já pode ter navegado por baixo
 * nesse meio tempo, só não fica visível até a splash sumir).
 */
SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignora — só pode falhar se chamado depois do auto-hide já ter
  // acontecido (corrida rara), o que não muda nada de importante.
});

/**
 * TASK-114 (Notificações) — mostra a notificação como banner/som
 * mesmo com o app aberto em primeiro plano (padrão do Expo é NÃO
 * mostrar nada nesse caso, achando que quem está usando o app não
 * precisa do aviso — aqui preferimos sempre mostrar).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * TASK-114 — o outro lado do comentário já deixado em
 * `pushNotifications.ts` ("colar isso no _layout.tsx quando o app
 * tiver rotas de produto"): toca numa notificação, abre a tela que a
 * Edge Function `send-push-notifications` mandou em `data.deepLink`.
 */
function useNotificationDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const deepLink = response.notification.request.content.data?.deepLink;
      if (typeof deepLink === "string") router.push(deepLink as never);
    });
    return () => subscription.remove();
  }, [router]);
}

function useHideSplashAfterDelay() {
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);
}

/**
 * TASK-096 (detalhes de série) — trocado de `<Slot />` pra `<Stack />`.
 * Até aqui, a raiz só tinha duas telas mutuamente exclusivas
 * ((auth) e (tabs), decidido por `<Redirect>` em `app/index.tsx`) —
 * `Slot` bastava. A partir de agora existe uma terceira rota de
 * primeiro nível, `series/[id]`, que precisa empilhar POR CIMA da
 * navegação por abas (deslizando de baixo pra cima, com "voltar" de
 * verdade) em vez de substituí-la — isso é exatamente o que `Stack`
 * faz e `Slot` não fazia. `(auth)` e `(tabs)` continuam sendo, cada
 * uma, seu próprio navegador aninhado (Stack/Tabs) — essa troca não
 * muda nada dentro delas.
 */
export default function RootLayout() {
  useNotificationDeepLinks();
  useHideSplashAfterDelay();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
