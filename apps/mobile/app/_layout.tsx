import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BlurTargetView } from "expo-blur";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { DockNavegacao } from "@/components/layout/DockNavegacao";
import { colors } from "@/lib/theme";
import { markFontsReady } from "@/lib/appReady";
import { useInAppUpdateCheck } from "@/lib/inAppUpdate";

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
 *
 * "Plus Jakarta Sans" (a pedido — "perfil não se parece com o web") —
 * ganhou uma SEGUNDA condição além da sessão: a fonte custom
 * (`useFonts` abaixo) também precisa terminar de carregar antes de
 * esconder, senão o app pisca com a fonte do sistema por um instante
 * antes de trocar pra Plus Jakarta Sans. As duas condições vivem em
 * `lib/appReady.ts` (`markFontsReady`/`markSessionReady`) — continua
 * sem piso de tempo fixo, só que agora esperando as duas, não só uma.
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
 * "Plus Jakarta Sans" (a pedido — "perfil não se parece com o web",
 * ver `lib/theme.ts` export `fontFamily` pro porquê de 5 pesos
 * separados) — precisa terminar de carregar (`fontsLoaded === true`)
 * antes da splash sumir, senão o app renderiza um instante com a
 * fonte do sistema (ver comentário grande acima, perto do
 * `preventAutoHideAsync`). `fontError` também libera a splash (não
 * trava o app pra sempre se o carregamento falhar por algum motivo —
 * cai pra fonte do sistema, pior do que o esperado mas usável).
 */
function useFontsReady() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) markFontsReady();
  }, [fontsLoaded, fontError]);
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
/**
 * A BARRA DE NAVEGAÇÃO MORA AQUI (2026-09-09, decisão do usuário — "a
 * barra de navegação não está aparecendo em várias telas").
 *
 * Ela vivia em `app/(tabs)/_layout.tsx`, então só existia dentro das 4
 * abas — e `series/[id]`, `movies/[id]`, `episodes/...`,
 * `profile/...`, `settings`, `lists`, `posts` e `u/...` são rotas de
 * primeiro nível DESTA Stack, fora de `(tabs)`. No web
 * (`app/(main)/layout.tsx`) a `<BottomNavigation />` fica no layout que
 * envolve TODAS as telas de produto, então aparece em todas elas.
 *
 * ESCONDIDA em duas situações, iguais às do web:
 *   - `(auth)` (login/cadastro/recuperar senha) — lá o
 *     `app/(auth)/layout.tsx` do web também não renderiza a barra;
 *   - `app/index.tsx`, que é só o `<Redirect>` de entrada e não chega a
 *     ser uma tela (segmentos vazios).
 *
 * Como o componente só é MONTADO quando visível, o polling de
 * recomendações não lidas que ele faz (a cada 30s) não roda na tela de
 * login — o que aconteceria se ele montasse sempre e só retornasse
 * `null` no fim.
 */
function ChromeDeNavegacao({ alvoDaTela }: { alvoDaTela: React.RefObject<View | null> }) {
  const segmentos = useSegments();
  const primeiro = segmentos[0];
  if (primeiro === undefined || primeiro === "(auth)") return null;
  return <DockNavegacao alvoDaTela={alvoDaTela} />;
}

export default function RootLayout() {
  useNotificationDeepLinks();
  useFontsReady();
  /**
   * IN-APP UPDATE DO GOOGLE PLAY (a pedido, 2026-09-16 — ver comentário
   * completo em `lib/inAppUpdate.ts`) — checa ao abrir o app e a cada
   * retomada de primeiro plano; roda no layout raiz porque precisa
   * existir em toda tela, não só dentro de `(tabs)`/`(auth)`.
   */
  useInAppUpdateCheck();
  /**
   * O ALVO DE DESFOQUE DA BARRA subiu junto com ela (estava em
   * `app/(tabs)/_layout.tsx`). Os dois precisam andar juntos: o
   * `BlurView` da barra tem que ficar FORA da `BlurTargetView` que ele
   * desfoca — aninhar é o ciclo que causa o SIGSEGV documentado em
   * `components/ui/Glass.tsx`. Por isso a `Stack` inteira fica dentro
   * do alvo e a barra é IRMÃ dele, não filha.
   */
  const alvoDaTela = useRef<View>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LocaleProvider>
          <AuthProvider>
            <View style={{ flex: 1, backgroundColor: colors.background }}>
              <StatusBar style="light" />
              <OfflineBanner />
              <ErrorBoundary>
                <BlurTargetView ref={alvoDaTela} style={styles.conteudo}>
                  <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
                </BlurTargetView>
                <ChromeDeNavegacao alvoDaTela={alvoDaTela} />
              </ErrorBoundary>
            </View>
          </AuthProvider>
        </LocaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  conteudo: {
    flex: 1,
  },
});
