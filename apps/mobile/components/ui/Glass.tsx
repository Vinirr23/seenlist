import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { glass, gel } from "@/lib/theme";

/**
 * Porte do redesign "âmbar/vidro" do web pro mobile — depende do
 * Expo SDK 55 (upgrade feito antes desse arquivo existir; ver
 * comentário completo em `lib/theme.ts`, export `glass`).
 *
 * COMO O BLUR NOVO FUNCIONA (achado real, mudou o desenho deste
 * arquivo) — `BlurView` não desfoca "a si mesma", ela mostra uma
 * versão desfocada do que está ATRÁS dela na tela, capturado por uma
 * `BlurTargetView` em algum ponto comum da árvore. As duas precisam
 * compartilhar a mesma `ref` (`blurTarget`). Por isso este arquivo é
 * TRÊS peças, não uma:
 *
 * 1. `GlassTargetProvider` — envolve o conteúdo real da tela (todo
 *    ele, incluindo o `AmbientGlow` abaixo) numa `BlurTargetView` só,
 *    uma vez, lá em cima (ex.: dentro do `ScrollView` da tela). Guarda
 *    a ref num Context pra não precisar passar por prop em cada card.
 * 2. `Glass` — o card em si (`BlurView`), sai pegando a ref do
 *    Context. Cai pra uma borda simples sem blur se usado fora de um
 *    `GlassTargetProvider` (não deveria acontecer, mas não quebra).
 * 3. `AmbientGlow` — MANCHAS DE COR de propósito, sem gradiente
 *    radial de verdade (RN não tem) — só ficam com essa cara de
 *    "borrão suave" quando alguma `Glass` está sobreposta a elas (o
 *    blur de verdade suaviza o que já é uma forma com borda em
 *    degradê). Sem uma camada de cor atrás, o vidro não tem o que
 *    mostrar — o fundo do app é escuro e quase liso.
 */
const GlassTargetContext = createContext<RefObject<View | null> | null>(null);

export function GlassTargetProvider({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const targetRef = useRef<View>(null);
  return (
    <BlurTargetView ref={targetRef} style={style}>
      <GlassTargetContext.Provider value={targetRef}>{children}</GlassTargetContext.Provider>
    </BlurTargetView>
  );
}

export interface GlassProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Card em "vidro" — usar no lugar de um `View` com `colors.surface` +
 * `colors.border` sempre que o card estiver dentro de um
 * `GlassTargetProvider` (telas ainda não convertidas continuam com o
 * visual antigo até a vez delas, por escolha — "tela a tela").
 */
export function Glass({ style, children, ...props }: GlassProps) {
  const target = useContext(GlassTargetContext);
  return (
    <BlurView
      blurTarget={target ?? undefined}
      intensity={glass.blurIntensity}
      tint="dark"
      blurMethod="dimezisBlurView"
      style={[styles.wrap, style]}
      {...props}
    >
      <LinearGradient
        colors={glass.gradientNeutral}
        start={{ x: 0.14, y: 0.15 }}
        end={{ x: 0.9, y: 0.85 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {children}
    </BlurView>
  );
}

export interface GelSurfaceProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * "Gel" âmbar — OPACO, sem blur, pra CTA/pílula em destaque (não é
 * vidro: não precisa estar dentro de um `GlassTargetProvider`, funciona
 * em qualquer tela).
 */
export function GelSurface({ style, children, ...props }: GelSurfaceProps) {
  return (
    <LinearGradient colors={gel.gradient} start={{ x: 0.28, y: 0.18 }} end={{ x: 0.85, y: 0.95 }} style={[styles.gelWrap, style]} {...props}>
      <LinearGradient
        colors={gel.highlight}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {children}
    </LinearGradient>
  );
}

const BLOBS: { color: string; top?: number; bottom?: number; left?: number; right?: number; size: number }[] = [
  { color: "rgba(232,163,61,0.5)", top: -60, left: -80, size: 260 },
  { color: "rgba(79,209,197,0.4)", top: 220, right: -100, size: 300 },
  { color: "rgba(232,163,61,0.32)", bottom: -40, left: -60, size: 240 },
];

/**
 * Campo de manchas de cor atrás do conteúdo — PRECISA estar dentro do
 * mesmo `GlassTargetProvider` que os cards em `Glass`, como primeiro
 * filho (fica atrás por ordem de renderização, não por z-index — RN
 * empilha na ordem em que os elementos aparecem). `pointerEvents="none"`
 * pra nunca capturar toque.
 */
export function AmbientGlow() {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {BLOBS.map((blob, index) => (
        <LinearGradient
          key={index}
          colors={[blob.color, "rgba(0,0,0,0)"]}
          start={{ x: 0.3, y: 0.3 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: "absolute",
            top: blob.top,
            bottom: blob.bottom,
            left: blob.left,
            right: blob.right,
            width: blob.size,
            height: blob.size,
            borderRadius: blob.size / 2,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: glass.borderNeutral,
  },
  gelWrap: {
    overflow: "hidden",
  },
});
