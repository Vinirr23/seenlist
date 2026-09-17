import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { PressableScale } from "@/components/ui";
import { colors, elevation } from "@/lib/theme";

/**
 * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-16, print real — "o 'v'
 * dentro do círculo branco não está certo", comparado direto com o
 * print do web que o usuário mandou em seguida).
 *
 * O mobile usava `<Feather name="check" />` — um GLIFO DE FONTE de
 * ícone. O web (`EpisodeWatchedButton.tsx`) usa o `Check` do
 * `lucide-react`, um desenho vetorial (`M20 6 9 17l-5-5`) com
 * `strokeWidth={2.5}`. Não são o mesmo desenho — mesmo padrão de
 * descompasso já visto antes neste app entre famílias de ícone
 * (`check-circle`/`check-circle-outline` do `SeasonAccordion.tsx`,
 * `film`/`movie-open-outline` da barra) — e fonte de ícone não dá pra
 * ajustar a espessura do traço nem garante o mesmo desenho do SVG
 * original.
 *
 * Fix: desenhado à mão com a geometria EXATA do path do lucide (dois
 * traços retos que se encontram no vértice `(9,17)` de um viewBox
 * 24×24 — braço curto até `(4,12)`, braço longo até `(20,6)`), como
 * duas `View`s retangulares com `borderRadius` (ponta arredondada,
 * equivalente ao `strokeLinecap: round` do SVG) giradas pro ângulo
 * certo — sem depender de nenhuma fonte de ícone, então o resultado é
 * pixel a pixel o mesmo em qualquer tamanho.
 */
function CheckMark({ size, color }: { size: number; color: string }) {
  const scale = size / 24;
  const strokeWidth = 2.5 * scale;
  // Vértice comum das duas pernas do "v", no viewBox 24×24 do lucide.
  const vertexX = 9;
  const vertexY = 17;

  function braco(pontaX: number, pontaY: number) {
    const comprimento = Math.hypot(pontaX - vertexX, pontaY - vertexY) * scale;
    const meioX = ((vertexX + pontaX) / 2) * scale;
    const meioY = ((vertexY + pontaY) / 2) * scale;
    const anguloGraus = (Math.atan2(pontaY - vertexY, pontaX - vertexX) * 180) / Math.PI;
    return {
      position: "absolute" as const,
      left: meioX - comprimento / 2,
      top: meioY - strokeWidth / 2,
      width: comprimento,
      height: strokeWidth,
      borderRadius: strokeWidth / 2,
      backgroundColor: color,
      transform: [{ rotate: `${anguloGraus}deg` }],
    };
  }

  return (
    <View style={{ width: size, height: size }}>
      {/* Braço longo — do vértice até (20,6), canto superior direito. */}
      <View style={braco(20, 6)} />
      {/* Braço curto — do vértice até (4,12), canto esquerdo. */}
      <View style={braco(4, 12)} />
    </View>
  );
}

/**
 * CORRIGIDO E CONFIRMADO (2026-09-16, quinta rodada — print ampliado
 * real do usuário, ✓ centralizado na Home E na tela de episódio):
 * causa raiz era o eixo vertical, não horizontal — `justifyContent`
 * do contêiner, não `alignSelf`. Ver histórico completo no commit
 * anterior. O contêiner `checkWrap` abaixo (`flex: 1`,
 * `alignItems`/`justifyContent: "center"`) é o fix definitivo; as
 * bordas de diagnóstico temporárias já cumpriram o papel e saíram.
 *
 * TAMANHO (2026-09-16, a pedido — "aumenta o tamanho do ✓") — só o
 * ícone cresceu, não o botão: círculo (`SIZES.*.button`) e área de
 * toque continuam do mesmo tamanho de sempre, só a proporção
 * ícone/círculo subiu de 50% pra ~60%.
 */
const SIZES = {
  sm: { button: 28, icon: 17 },
  md: { button: 32, icon: 19 },
  lg: { button: 40, icon: 24 },
} as const;

/**
 * TASK-099 (correção — pedido do usuário) — porta fiel de
 * `EpisodeWatchedButton.tsx` do web: botão REDONDO (não quadrado
 * como eu tinha feito antes), branco com check preto quando não
 * assistido, colorido (dourado/`colors.primary`) com check branco
 * quando assistido. Um componente único, usado tanto no carrossel
 * do topo quanto em cada linha da lista de temporada — igual ao web,
 * que também reaproveita o mesmo componente nos dois lugares.
 */
export function EpisodeWatchedButton({
  watched,
  onPress,
  disabled,
  size = "md",
  color,
  confirmColor,
  pulseOnConfirm = false,
}: {
  watched: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  /**
   * BUG REAL, CAUSA RAIZ ENCONTRADA (2026-09-15 — "no web, ao colocar
   * uma série em 'assistir depois' fica da cor certa do status, no
   * mobile não está") — porte fiel do `colorClass` do
   * `EpisodeWatchedButton.tsx` do web (TASK-060, "quando assistido,
   * volta a usar a cor da categoria da série"): cor de fundo do estado
   * `watched`, vinda da categoria atual (`getSeriesCategoryColorByStatus`,
   * `lib/seriesCategories.ts`). Opcional e com o mesmo padrão de
   * antes (`colors.primary`, âmbar) como resultado quando quem chama
   * não informa — nenhum uso existente quebra.
   */
  color?: string;
  /**
   * A PEDIDO (2026-09-04, fidelidade ao web — mesma decisão documentada
   * em `EpisodeWatchedButton.tsx`/`ContinueWatchingCard.tsx` do web:
   * "verde na confirmação, só ali e só transitório; não muda a cor 'de
   * categoria' padrão do botão em nenhum outro lugar do app") — troca a
   * cor de fundo do estado `watched` só enquanto informado, por cima
   * até da cor de categoria (`color`) — sempre vence as duas. Usado
   * hoje só por `ContinueWatchingListRow.tsx`, durante a animação de
   * confirmação.
   */
  confirmColor?: string;
  /**
   * A PEDIDO (2026-09-17, "adicionar uma animação leve na hora de
   * marcar/desmarcar" na tela de Detalhes de Série) — `false` por
   * padrão de propósito: este botão é COMPARTILHADO com
   * `ContinueWatchingListRow.tsx` (Home), que já tem sua PRÓPRIA
   * animação de confirmação por fora (escala + anel + confete —
   * `buttonWrapperStyle`/`ringStyle` lá). Ligar o pulso aqui sem essa
   * flag faria as duas animações se somarem na Home, brigando uma com
   * a outra. Só os dois lugares da tela de Detalhes de Série
   * (`SeasonAccordion.tsx`, `EpisodeCarousel.tsx`) passam `true`.
   */
  pulseOnConfirm?: boolean;
}) {
  const dimensions = SIZES[size];

  /**
   * A PEDIDO (2026-09-17) — pulso leve: o botão cresce um pouco e
   * volta ao marcar/desmarcar, além do encolher que já existe ao
   * pressionar (`PressableScale`, por fora — os dois transforms se
   * somam, sem conflito). Só dispara quando `watched` MUDA de verdade
   * (não na primeira renderização, senão todo botão "pulsaria" sozinho
   * assim que a tela abrisse).
   */
  const pulse = useSharedValue(1);
  const primeiraRenderizacao = useRef(true);
  useEffect(() => {
    if (!pulseOnConfirm) return;
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    pulse.value = withSequence(
      withTiming(1.22, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched, pulseOnConfirm]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <PressableScale hitSlop={8}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: watched }}
      style={[
        styles.button,
        {
          width: dimensions.button,
          height: dimensions.button,
          borderRadius: dimensions.button / 2,
          backgroundColor: watched ? (confirmColor ?? color ?? colors.primary) : "#FFFFFF",
        },
        disabled && styles.disabled,
      ]}
    >
      <Animated.View style={[styles.checkWrap, pulseOnConfirm && pulseStyle]}>
        <CheckMark size={dimensions.icon} color={watched ? "#FFFFFF" : "#000000"} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: elevation.low.shadowColor,
    shadowOpacity: elevation.low.shadowOpacity,
    shadowRadius: elevation.low.shadowRadius,
    shadowOffset: elevation.low.shadowOffset,
    elevation: elevation.low.elevation,
  },
  disabled: {
    opacity: 0.5,
  },
  /**
   * O contêiner real que centraliza o `CheckMark` nos dois eixos —
   * ver o comentário acima de `SIZES`. `flex: 1` ocupa a área que o
   * `Animated.View` do `PressableScale` já preenche (o círculo
   * inteiro); sem `width` própria, o `stretch` padrão do pai estica
   * ESTE `View` (que não tem tamanho fixo) pra largura toda —
   * diferente do `CheckMark`, que tem `width`/`height` fixos e por
   * isso não deve ser esticado.
   */
  checkWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
