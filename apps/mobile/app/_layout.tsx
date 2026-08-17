import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { colors } from "@/lib/theme";
import { mark } from "@/lib/perfMarks";

/**
 * TASK-165 (splash, retomada) — sem isso, a splash NATIVA (a que o
 * Android mostra sozinho, configurada em app.json) some assim que o
 * JavaScript termina de montar o primeiro componente — em aparelhos
 * rápidos isso pode ser rápido demais pra dar tempo de ver, do jeito
 * que o usuário percebeu. `preventAutoHideAsync()` (chamado aqui, no
 * escopo do módulo — precisa rodar antes de qualquer render) avisa o
 * sistema pra NÃO esconder a splash sozinho.
 *
 * CORREÇÃO TEMPORÁRIA (a pedido — medição real de cold start em
 * andamento) — antes, escondia com um tempo FIXO de 3s, sempre,
 * mesmo que o app estivesse pronto bem antes. Isso distorce qualquer
 * medição de "tempo até tela útil": por fora (cronômetro, métrica do
 * próprio Android), NUNCA apareceria menos que ~3s, escondendo
 * qualquer ganho real de otimização por trás do piso artificial.
 *
 * Trocado pra esconder assim que a sessão resolver de verdade (mesmo
 * momento do `mark("session_resolved")` em AuthProvider.tsx) — sem
 * piso mínimo. Isso volta a expor o problema original (em aparelho
 * rápido, pode sumir rápido demais e parecer "piscar") — mas é
 * intencional PRA ESTA FASE: primeiro descobre a velocidade real,
 * depois decide se ainda faz sentido um piso mínimo (e de quanto —
 * 3s pode ter sido generoso demais mesmo no cenário original).
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
  mark("root_layout_render"); // TEMPORÁRIO — ver lib/perfMarks.ts

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocaleProvider>
          <AuthProvider>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <StatusBar style="light" />
              <OfflineBanner />
              <ErrorBoundary>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
              </ErrorBoundary>
            </View>
          </AuthProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
