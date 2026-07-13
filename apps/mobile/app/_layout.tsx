import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { colors } from "@/lib/theme";

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
