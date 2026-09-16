import { useRef, useState } from "react";
import { View, StyleSheet, PanResponder, type LayoutChangeEvent } from "react-native";
import { Text } from "@/components/ui";
import { colors, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 22;
const TOUCH_AREA_HEIGHT = 32; // maior que o THUMB_SIZE — alvo de toque confortável sem aumentar o visual da trilha.

function clamp01(n: number): number {
  "worklet";
  return Math.min(1, Math.max(0, n));
}

/**
 * NOVO (a pedido — "eu não consigo redimensionar o banner pra ficar
 * do jeito que eu quero", 2026-09-16) — controle de arrastar pra
 * ajustar `banner_focal_y` (0 = topo da foto, 0.5 = centro/padrão,
 * 1 = base), mesmo valor que `contentPosition`/`object-position`
 * (web) usam pra recortar a foto.
 *
 * Implementado com `PanResponder` (API pura do React Native core, sem
 * `react-native-gesture-handler`/`reanimated`) — decisão deliberada:
 * esta mesma sessão passou o dia inteiro resolvendo uma cadeia de
 * builds nativos quebrados no Android (path do Windows, JDK, cache do
 * Gradle — ver histórico do projeto), então qualquer dependência
 * nativa NOVA arriscaria reabrir esse problema logo antes do envio pra
 * Play Store. `PanResponder` não precisa de rebuild nenhum.
 *
 * Barra HORIZONTAL de propósito, mesmo controlando um ajuste
 * VERTICAL: arrastar o dedo na horizontal é mais fácil de acertar com
 * precisão numa tela de celular do que verticalmente (mesmo raciocínio
 * de qualquer slider de volume/brilho do sistema) — ponta esquerda =
 * "topo" da foto, ponta direita = "base". Equivalente ao
 * `<input type="range">` do web, só que sem elemento HTML.
 *
 * `onChange` dispara a cada frame do arrasto (preview ao vivo, local
 * só — não salva nada); `onCommit` dispara só quando o dedo SOLTA a
 * tela, pra não gravar no banco a cada pixel arrastado (mesmo padrão
 * do slider do web, que usa `onMouseUp`/`onTouchEnd`, não `onChange`).
 */
export function BannerFocalYSlider({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const { t } = useTranslation();
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  // Necessário porque `onPanResponderMove`/`onPanResponderRelease` são
  // closures criadas UMA VEZ (dentro do `useRef` abaixo) — sem essas
  // refs, eles enxergariam sempre o `value`/`trackWidth` da primeira
  // renderização, nunca o mais atual.
  const valueRef = useRef(value);
  valueRef.current = value;
  const dragStartValueRef = useRef(value);

  function handleLayout(event: LayoutChangeEvent) {
    const width = event.nativeEvent.layout.width;
    trackWidthRef.current = width;
    setTrackWidth(width);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const width = trackWidthRef.current;
        if (!width) return;
        // Toque inicial já pula o valor pra onde o dedo encostou (não
        // só arrasto a partir do valor atual) — mesmo comportamento
        // esperado de qualquer slider ao tocar fora da bolinha.
        const next = clamp01(event.nativeEvent.locationX / width);
        dragStartValueRef.current = next;
        onChange(next);
      },
      // `gestureState.dx` é o deslocamento acumulado DESDE o toque
      // inicial (não a posição absoluta do dedo) — é o valor confiável
      // recomendado pela documentação do RN pra isso; `locationX` em
      // eventos de `move` tem inconsistências conhecidas entre
      // Android/iOS quando o dedo sai da view original.
      onPanResponderMove: (_event, gestureState) => {
        const width = trackWidthRef.current;
        if (!width) return;
        const next = clamp01(dragStartValueRef.current + gestureState.dx / width);
        onChange(next);
      },
      onPanResponderRelease: () => {
        onCommit(valueRef.current);
      },
      onPanResponderTerminate: () => {
        onCommit(valueRef.current);
      },
    })
  ).current;

  const clampedValue = clamp01(value);
  const thumbLeft = trackWidth ? clampedValue * trackWidth - THUMB_SIZE / 2 : -THUMB_SIZE / 2;
  const fillWidth = trackWidth ? clampedValue * trackWidth : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text variant="muted" style={styles.label}>
          {t("profile.bannerPosition")}
        </Text>
        <Text variant="muted" style={styles.valueLabel}>
          {t("profile.bannerPositionTop")} · {t("profile.bannerPositionBottom")}
        </Text>
      </View>
      <View style={styles.touchArea} onLayout={handleLayout} {...panResponder.panHandlers}>
        <View style={styles.track} />
        <View style={[styles.trackFill, { width: fillWidth }]} />
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: fontSize.xxs,
  },
  valueLabel: {
    fontSize: fontSize.xxs,
  },
  touchArea: {
    height: TOUCH_AREA_HEIGHT,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.border,
  },
  trackFill: {
    position: "absolute",
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.primary,
  },
  thumb: {
    position: "absolute",
    top: (TOUCH_AREA_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
