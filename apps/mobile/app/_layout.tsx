import { useEffect, useRef, useState } from "react";
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
import { AnimatedSplash } from "@/components/layout/AnimatedSplash";
import { WhatsNewModal } from "@/components/whats-new/WhatsNewModal";
import { FatalErrorOverlay } from "@/components/layout/FatalErrorOverlay";
import { colors } from "@/lib/theme";
import { markFontsReady } from "@/lib/appReady";
import { useInAppUpdateCheck } from "@/lib/inAppUpdate";
import { useOtaUpdateCheck } from "@/lib/otaUpdate";
import { installGlobalErrorHandler } from "@/lib/globalErrorHandler";

/**
 * DIAGNÓSTICO TEMPORÁRIO (2026-10-09) — ver comentário completo em
 * `lib/globalErrorHandler.ts`. Precisa rodar no escopo do MÓDULO
 * (fora de qualquer componente), igual ao `preventAutoHideAsync()`
 * abaixo — antes de qualquer render, pra não perder nenhum erro
 * fatal que aconteça logo no começo.
 */
installGlobalErrorHandler();

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
 * `lib/appReady.ts` (`markFontsReady`/`markSessionReady`).
 *
 * CORREÇÃO (2026-10-06, splash animada aprovada em mockup) — quem
 * chama `SplashScreen.hideAsync()` NÃO é mais este arquivo nem
 * `lib/appReady.ts`: é `components/layout/AnimatedSplash.tsx`, que
 * esconde a splash nativa assim que ELA PRÓPRIA pinta o primeiro
 * frame (idêntico visualmente à splash nativa, então a troca não dá
 * pra perceber) e só revela o app de verdade quando a animação
 * (1200ms) E fontes+sessão (`lib/appReady.ts`) tiverem terminado — o
 * que vier depois. Continua sem piso de tempo fixo NO SENTIDO
 * ORIGINAL do comentário acima (não força um mínimo além do que o
 * carregamento real precisa) — ver comentário grande em
 * `AnimatedSplash.tsx` pro raciocínio completo.
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
 *
 * CORREÇÃO DE CAUSA RAIZ (2026-09-25, bug real reportado — "quando
 * chega notificações, quando aperto, ao invés de ir pra tela de
 * referência da notificação, aparece" a tela "Unmatched Route" /
 * "seenlist:///") — `addNotificationResponseReceivedListener`
 * (abaixo) só recebe o toque numa notificação enquanto o app JÁ
 * ESTÁ RODANDO (primeiro ou segundo plano) — é o comportamento
 * documentado do próprio `expo-notifications`. Com o app TOTALMENTE
 * FECHADO, o toque que ABRE o app não passa por esse listener: o
 * `Linking` que o expo-router usa pra resolver a rota inicial recebe
 * só o esquema puro (`seenlist://`, sem nenhum caminho), porque
 * `data.deepLink` é uma chave nossa (inventada pela Edge Function),
 * não algo que o sistema operacional/`Linking` sabe interpretar
 * sozinho — daí "Unmatched Route" antes mesmo do JS reagir.
 *
 * Fix: `getLastNotificationResponseAsync()` — API do próprio
 * `expo-notifications` feita exatamente pra esse caso ("app abriu
 * por causa de uma notificação, mas eu perdi o evento porque ainda
 * nem tinha subido") — devolve a notificação que abriu o app, se
 * houver, pra então navegar também. Usa `router.replace` (não
 * `push`) aqui, porque está substituindo a tela errada
 * ("Unmatched Route") que já ficou no topo da pilha, não empilhando
 * por cima dela.
 *
 * `handledIds` evita o mesmo toque navegar DUAS vezes — em algumas
 * versões/plataformas o listener normal também dispara pro mesmo
 * toque que abriu o app (a ordem entre os dois não é garantida, por
 * isso o `Set` funciona nos dois sentidos).
 */
function useNotificationDeepLinks() {
  const router = useRouter();
  const handledIds = useRef(new Set<string>());

  useEffect(() => {
    function navigateToDeepLink(response: Notifications.NotificationResponse, options: { replace: boolean }) {
      const id = response.notification.request.identifier;
      if (handledIds.current.has(id)) return;
      handledIds.current.add(id);

      const deepLink = response.notification.request.content.data?.deepLink;
      if (typeof deepLink !== "string" || deepLink.length === 0) return;
      if (options.replace) router.replace(deepLink as never);
      else router.push(deepLink as never);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      navigateToDeepLink(response, { replace: false })
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) navigateToDeepLink(response, { replace: true });
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
 *
 * TERCEIRA EXCEÇÃO (2026-09-23, a pedido — "a barra inferior está
 * competindo com a feature... se essa tela for modal/fullscreen, eu
 * consideraria esconder a bottom tab enquanto o Week Review estiver
 * aberto. Isso deixaria a experiência mais 'evento' e menos 'mais uma
 * tela do app'") — `week-review` (`app/week-review.tsx`, a tela REAL de
 * produção, rodada 26) some da mesma lista.
 *
 * CORREÇÃO (2026-09-24, a pedido — "remover a tela de teste") — a
 * exceção pra `week-review-test` (rota temporária de teste,
 * `app/week-review-test.tsx`) foi removida junto com o arquivo da
 * rota em si, que não existe mais.
 */
function ChromeDeNavegacao({ alvoDaTela }: { alvoDaTela: React.RefObject<View | null> }) {
  const segmentos = useSegments();
  const primeiro = segmentos[0];
  /**
   * POLIMENTO (2026-10-07, a pedido explícito do usuário — "Resumo da
   * Temporada" tela cheia) — mesmo raciocínio já documentado acima pro
   * Week Review: experiência secundária/tela-cheia, o botão de voltar
   * já é suficiente, a barra só adicionaria ruído visual.
   * `season-recap` é checado com `segmentos.includes(...)` em vez de
   * `primeiro ===` porque a rota é aninhada
   * (`series/[id]/season-recap/[season]`) — `useSegments()` devolve os
   * segmentos literais do caminho do arquivo, então o nome fica no
   * meio do array, não na posição 0 (onde fica `week-review`, uma
   * rota no topo).
   */
  if (primeiro === undefined || primeiro === "(auth)" || primeiro === "week-review" || segmentos.includes("season-recap"))
    return null;
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
   * ATUALIZAÇÃO OTA AUTOMÁTICA (a pedido, 2026-09-22 — "como faço para
   * TODOS os usuários receberem o update?", ver comentário completo em
   * `lib/otaUpdate.ts`) — DIFERENTE do `useInAppUpdateCheck()` acima
   * (aquele é o binário nativo via Play Store; este é o JS via EAS
   * Update). Checa ao montar e a cada retomada de primeiro plano;
   * mesmo motivo de morar no layout raiz — precisa rodar em toda tela.
   */
  useOtaUpdateCheck();
  /**
   * O ALVO DE DESFOQUE DA BARRA subiu junto com ela (estava em
   * `app/(tabs)/_layout.tsx`). Os dois precisam andar juntos: o
   * `BlurView` da barra tem que ficar FORA da `BlurTargetView` que ele
   * desfoca — aninhar é o ciclo que causa o SIGSEGV documentado em
   * `components/ui/Glass.tsx`. Por isso a `Stack` inteira fica dentro
   * do alvo e a barra é IRMÃ dele, não filha.
   */
  const alvoDaTela = useRef<View>(null);
  /**
   * Splash animada (ver `AnimatedSplash.tsx`) — montada uma vez, por
   * padrão visível; ela mesma chama `onDone` quando sua própria saída
   * (fontes+sessão prontas E animação terminada) acontece, e só então
   * sai da árvore. Daqui pra frente não remonta mais nesta sessão do
   * app (não é re-renderizada a cada navegação nem a cada retomada de
   * primeiro plano).
   */
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

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
                {/*
                  * NOVO (2026-10-07) — "Novidades" (modal comemorativo,
                  * opção A do mockup aprovado). Mesmo nível de
                  * `ChromeDeNavegacao`: precisa existir em toda tela de
                  * produto, não só dentro de `(tabs)`. O componente
                  * mesmo decide quando se mostrar (sessão resolvida,
                  * fora de `(auth)`, novidade não vista) — aqui é só
                  * "sempre montado".
                  */}
                <WhatsNewModal />
                {showAnimatedSplash && <AnimatedSplash onDone={() => setShowAnimatedSplash(false)} />}
              </ErrorBoundary>
              <FatalErrorOverlay />
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
