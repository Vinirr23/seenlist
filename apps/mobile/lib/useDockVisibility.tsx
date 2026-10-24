import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useSegments } from "expo-router";

/**
 * NOVO (a pedido, 2026-10-16 — "em todas as telas adiciona a barra de
 * navegações o esconder ao rolar que adicionamos ao botão de 'escolha
 * pra mim'") — MESMO padrão já aprovado e testado em `movies.tsx`
 * (`handleMinhaListaScroll`/`whatToWatchScrollHidden`/`whatToWatchVisible`),
 * generalizado aqui porque a barra (`DockNavegacao.tsx`) é um
 * componente ÚNICO, montado uma vez na RAIZ do app (`app/_layout.tsx`,
 * `ChromeDeNavegacao`) — ela não é filha de nenhuma tela, então não dá
 * pra passar o estado de rolagem como prop direto de cada tela. Este
 * Context é o "fio" que liga as telas (que sabem quando o usuário está
 * rolando) à barra (que precisa saber disso pra se esconder/reaparecer),
 * sem acoplar as duas.
 *
 * Escopo combinado com o usuário (2026-10-16, 3 opções oferecidas —
 * "só as 5 abas" / "abas + telas de lista grandes" / "absolutamente
 * tudo"): escolhida a opção do meio — as 5 abas principais mais as
 * telas de lista vertical longa como conteúdo principal (favoritos,
 * avaliações, comentários, notificações, listas, perfil público,
 * seguidores). Sheets/modais (seletor de país, de plataforma etc.)
 * ficam de fora de propósito: a barra nem aparece atrás deles.
 */
type DockVisibilityContextValue = {
  /** 1 = barra visível, 0 = escondida — já animado (`useNativeDriver`), pronto pra usar direto em `opacity`. */
  dockOpacity: Animated.Value;
  /** Deslocamento vertical derivado de `dockOpacity` — 0 (visível) a `HIDE_DISTANCE` (fora da tela, embaixo). */
  dockTranslateY: Animated.AnimatedInterpolation<number>;
  /** true enquanto a barra está escondida — usado só pra decidir `pointerEvents` (nunca pra estilo; ver `dockOpacity`/`dockTranslateY`). */
  dockHidden: boolean;
  /**
   * Handler de `onScroll` pronto pra passar direto a qualquer
   * `FlatList`/`ScrollView` vertical de tela (`onScroll={reportDockScroll}
   * scrollEventThrottle={16}`). MESMA lógica de `movies.tsx`: esconde
   * rolando pra baixo, reaparece rolando de volta pra cima, sempre
   * visível perto do topo, ignora tremor mínimo.
   */
  reportDockScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Força a barra de volta a visível e zera a referência de scroll —
   * pra telas com ABAS INTERNAS (ex.: `movies.tsx`, "Minha Lista"/"Em
   * breve"): cada troca de aba interna costuma remontar a lista com
   * offset 0, e sem isto a barra podia ficar presa "escondida" mesmo a
   * lista nova começando do topo. O Provider já faz isso sozinho a
   * cada troca de ROTA (ver `useEffect` abaixo) — isto aqui é só pra
   * quando a tela muda de aba SEM mudar de rota.
   */
  resetDockVisible: () => void;
};

const DockVisibilityContext = createContext<DockVisibilityContextValue | null>(null);

/** Distância que a barra desliza pra baixo ao esconder — generosa o bastante pra sumir de vez (sombra inclusa) sem precisar saber a altura exata do dock aqui. */
const HIDE_DISTANCE = 110;
/** Mesma duração/curva já usada em `movies.tsx` pro botão "Escolhe pra mim" — consistência entre os dois esconde-ao-rolar do app. */
const ANIM_DURATION = 220;

export function DockVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastScrollYRef = useRef(0);
  const dockOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(dockOpacity, {
      toValue: hidden ? 0 : 1,
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [hidden, dockOpacity]);

  /**
   * CORREÇÃO DE CAUSA RAIZ — sem isto, navegar PRA UMA TELA NOVA
   * enquanto a barra estava escondida (rolado pra baixo na tela
   * anterior) deixaria a barra presa escondida na tela nova também,
   * mesmo ela abrindo do topo. `useSegments()` muda a cada navegação
   * de rota de verdade (troca de tela) — reseta aqui junto.
   */
  const segments = useSegments() as string[];
  const routeKey = segments.join("/");
  useEffect(() => {
    lastScrollYRef.current = 0;
    setHidden(false);
  }, [routeKey]);

  const reportDockScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const delta = y - lastScrollYRef.current;
    lastScrollYRef.current = y;
    if (y <= 8) {
      // Perto do topo — sempre visível (evita esconder por causa de um "overscroll" pequeno logo no início).
      setHidden(false);
      return;
    }
    if (Math.abs(delta) < 4) return; // ignora tremor mínimo (não é rolagem de verdade).
    setHidden(delta > 0);
  }, []);

  const resetDockVisible = useCallback(() => {
    lastScrollYRef.current = 0;
    setHidden(false);
  }, []);

  const dockTranslateY = useMemo(
    () => dockOpacity.interpolate({ inputRange: [0, 1], outputRange: [HIDE_DISTANCE, 0] }),
    [dockOpacity]
  );

  const value = useMemo<DockVisibilityContextValue>(
    () => ({ dockOpacity, dockTranslateY, dockHidden: hidden, reportDockScroll, resetDockVisible }),
    [dockOpacity, dockTranslateY, hidden, reportDockScroll, resetDockVisible]
  );

  return <DockVisibilityContext.Provider value={value}>{children}</DockVisibilityContext.Provider>;
}

/** Pra telas: só `reportDockScroll` (ligar no `onScroll` da lista principal) e, se a tela tiver abas internas, `resetDockVisible`. */
export function useDockVisibility(): DockVisibilityContextValue {
  const ctx = useContext(DockVisibilityContext);
  if (!ctx) {
    throw new Error("useDockVisibility() precisa estar dentro de <DockVisibilityProvider> (ver app/_layout.tsx).");
  }
  return ctx;
}
