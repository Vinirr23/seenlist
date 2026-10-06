import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, AccessibilityInfo } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui";
import { colors } from "@/lib/theme";
import { safeBottomInset } from "@/lib/safeBottomInset";
import { isAppReady, onAppReady, isFontsReady, onFontsReady } from "@/lib/appReady";

const mark = require("@/assets/images/splash-mark.png");

/**
 * CORREÇÃO DE RAIZ (2026-10-06, reportado com prints — "a logo ficou
 * muito pequena") — era 126. CAUSA RAIZ: a splash NATIVA (`app.json`,
 * plugin `expo-splash-screen`, `imageWidth: 200`) usa a logo em
 * 200px, mas esta camada animada (que assume a cena logo depois,
 * ver comentário grande da função acima — "a troca não é
 * perceptível") estava com um tamanho bem menor, sem relação com o
 * valor nativo — por isso a logo "encolhia" visivelmente no instante
 * da troca. Igualado a 200, o mesmo valor do nativo.
 */
const MARK_SIZE = 200;
const FADE_MS = 1200;
const EXIT_FADE_MS = 220;

/**
 * SPLASH ANIMADA (2026-10-06, mockup aprovado — fade da logo + flash
 * claro por cima, 1200ms, sobre o fundo escuro; nome "SeenList"
 * estático no rodapé, sem fade). Visual e timing exatos do mockup
 * aprovado; cores ajustadas pro design system real na revisão (fundo
 * `#090d14` → `colors.background`, azul do wordmark `#538BCD` →
 * `colors.info`, mantendo os 50% de opacidade).
 *
 * TIMING ("opção 2", decisão explícita do usuário entre as duas
 * discutidas) — a splash nativa (`app.json`, `expo-splash-screen`)
 * já fica na tela até fontes+sessão resolverem (ver
 * `lib/appReady.ts`), sem piso de tempo fixo (decisão anterior,
 * deliberada, pra medir cold start de verdade). Essa camada NÃO
 * espera fontes/sessão pra começar — esconde a splash nativa e
 * começa a animar assim que ELA PRÓPRIA pinta o primeiro frame (mesmo
 * fundo, mesma logo, mesma posição — a troca não é perceptível).
 * A animação (1200ms) roda EM PARALELO ao carregamento real; só
 * revela o app de verdade quando as duas coisas tiverem terminado — o
 * que vier depois. Na prática: se fontes+sessão demoram menos de
 * 1200ms (comum), o usuário só vê os 1200ms da animação, sem atraso
 * extra. Se demoram mais, a animação já tinha acabado bem antes e o
 * app só espera o resto do carregamento real (sem reintroduzir um
 * piso fixo em cima do que já existia).
 *
 * O WORDMARK só aparece depois que `isFontsReady()` for verdade (ver
 * `fontsVisible`, abaixo) — não é o mesmo "esperar fontes" que a
 * splash nativa fazia antes: aqui é só o texto "SeenList" (o símbolo
 * já anima desde o frame 1, sem depender de fonte nenhuma). Sem essa
 * guarda, o texto apareceria um instante na fonte do sistema e
 * trocaria pra Plus Jakarta Sans assim que carregasse — exatamente o
 * pisca que a splash nativa foi feita pra evitar, só que agora dentro
 * da própria animação. Fontes carregam rápido (arquivo local, sem
 * rede) — na prática o atraso é imperceptível, e o resto da animação
 * (símbolo + flash) não depende disso.
 *
 * MOVIMENTO REDUZIDO — pula fade e flash (pedido explícito do
 * mockup): símbolo aparece direto em opacidade 1, sem o flash, e a
 * camada libera o app assim que `isAppReady()` for verdade (sem
 * esperar os 1200ms, que não fazem sentido sem a animação).
 *
 * SÓ UMA VEZ POR ABERTURA — este componente é montado uma vez só, na
 * raiz (`app/_layout.tsx`), e desmontado (via `onDone`) depois que
 * sai de cena; não remonta em retomada de app (não é re-renderizado
 * a cada navegação/foreground, só existe nesse primeiro instante).
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [fontsVisible, setFontsVisible] = useState(isFontsReady());
  const [appReady, setAppReady] = useState(isAppReady());
  const [animationDone, setAnimationDone] = useState(false);
  const exitingRef = useRef(false);

  const markOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // Esconde a splash NATIVA assim que esta camada já pintou o 1º frame — ver comentário grande acima ("TIMING").
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Ignora — só pode falhar se chamado depois do auto-hide já ter acontecido (corrida rara).
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduceMotion(value);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => onFontsReady(() => setFontsVisible(true)), []);
  useEffect(() => onAppReady(() => setAppReady(true)), []);

  useEffect(() => {
    if (reduceMotion === null) return; // ainda checando a preferência — não decide nada por engano
    if (reduceMotion) {
      markOpacity.setValue(1);
      setAnimationDone(true);
      return;
    }

    Animated.timing(markOpacity, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
    }).start();

    // Flash: 0 até 576ms, sobe a 0.82 em 744ms, desce a 0.55 em 864ms, volta a 0 em 1200ms — interpolação linear, igual ao mockup aprovado.
    Animated.sequence([
      Animated.delay(576),
      Animated.timing(flashOpacity, { toValue: 0.82, duration: 168, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0.55, duration: 120, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 336, easing: Easing.linear, useNativeDriver: true }),
    ]).start(() => setAnimationDone(true));
  }, [reduceMotion, markOpacity, flashOpacity]);

  useEffect(() => {
    if (!appReady || !animationDone || exitingRef.current) return;
    exitingRef.current = true;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: EXIT_FADE_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => onDone());
  }, [appReady, animationDone, containerOpacity, onDone]);

  return (
    <Animated.View style={[styles.overlay, { opacity: containerOpacity }]} pointerEvents="none">
      <View style={styles.markWrap}>
        <Animated.Image source={mark} style={[styles.mark, { opacity: markOpacity }]} />
        <Animated.Image source={mark} style={[styles.mark, styles.flash, { opacity: flashOpacity }]} />
      </View>
      {fontsVisible && (
        <Text style={[styles.wordmark, { bottom: 24 + safeBottomInset(insets.bottom) }]}>SeenList</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  markWrap: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  mark: {
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  flash: {
    tintColor: "#ffffff",
  },
  wordmark: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.3,
    color: colors.info,
    opacity: 0.5,
  },
});
