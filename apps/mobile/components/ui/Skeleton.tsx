import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, View, StyleSheet, type DimensionValue, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { radius as themeRadius } from "@/lib/theme";

/**
 * CORREÇÃO DE RAIZ (2026-09-15, bug real reportado com print — "o
 * esqueleton está errado", tela Séries > Minha Lista, modo lista) — a
 * versão anterior deste componente pintava o retângulo fantasma com
 * `colors.surface` (opacidade pulsando entre 0.15 e 0.35). O problema:
 * TODO lugar que usa `Skeleton` (`LibraryListSkeleton`,
 * `LibraryGridSkeleton`, `UpcomingEpisodeCardSkeleton`,
 * `AvatarRowSkeleton` etc.) também usa `colors.surface` como fundo do
 * CONTÊINER ao redor de cada `Skeleton`. Uma cor translúcida sentada em
 * cima de uma cópia OPACA da MESMA cor é matematicamente indistinguível
 * dela (alpha blend de uma cor C sobre um fundo opaco da mesma cor C dá
 * C, não importa a opacidade) — por isso o "fantasma" de pôster+texto
 * dentro de cada linha sumia por completo, sobrando só o contorno da
 * linha em si, exatamente o que apareceu no print.
 *
 * Duas mudanças, as duas na raiz (aqui, não em cada um dos ~13 lugares
 * que usam este componente — todos herdam a correção automaticamente):
 * 1. A cor base do fantasma virou um branco translúcido FIXO
 *    (`rgba(255,255,255,0.07)`), independente de qualquer token de
 *    fundo — não pode mais coincidir com o fundo de nenhum contêiner.
 * 2. O pulsar de opacidade virou "shimmer" (um brilho varrendo da
 *    esquerda pra direita, em loop) — opção 3 de 4 formatos mostrados
 *    ao usuário numa prévia comparativa (pontinhos iguais ao web antigo/
 *    fantasma só com contraste corrigido/shimmer/respiração do cartão
 *    inteiro); o usuário escolheu shimmer, e pediu a MESMA mudança no
 *    `HomeSkeleton.tsx`/`EmBreveSkeleton` do web (ver comentários lá) —
 *    os dois lados agora usam o mesmo conceito visual.
 */
export function Skeleton({
  width,
  height,
  borderRadius = themeRadius.md,
  style,
}: {
  width: DimensionValue;
  height: DimensionValue;
  borderRadius?: number;
  style?: object;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [layoutWidth, setLayoutWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setLayoutWidth(event.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    if (!layoutWidth) return;
    // Reseta pra -layoutWidth (fora da view, à esquerda) SEM animação
    // (duration: 0) no início de cada volta do loop, e só então anima
    // até +layoutWidth — garante que a faixa de brilho sempre percorre
    // o trajeto inteiro, mesmo que `Animated.loop` não reponha o valor
    // sozinho entre repetições.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: -layoutWidth, duration: 0, useNativeDriver: true }),
        Animated.delay(150),
        Animated.timing(translateX, {
          toValue: layoutWidth,
          duration: 900,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [layoutWidth, translateX]);

  return (
    <View
      onLayout={handleLayout}
      style={[
        { width, height, borderRadius, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
        style,
      ]}
    >
      {layoutWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { width: layoutWidth, transform: [{ translateX }] }]}>
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.16)", "transparent"]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}
