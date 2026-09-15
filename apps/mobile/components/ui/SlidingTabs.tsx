import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "./Text";
import { Glass } from "./Glass";
import { colors, gel, gelBlue, radius, spacing, motion } from "@/lib/theme";

const TRACK_PADDING = 4;

/**
 * A PEDIDO — trilha com cápsula deslizante, generalizada. Achado
 * real: existiam DUAS cópias praticamente idênticas desse padrão de
 * "dois botões soltos, sem animação" — `HomeTabs.tsx` (Minha
 * lista/Em breve) e um `TabButton` local dentro de `explore.tsx`
 * (Descobrir/Atividade). Corrigi a primeira e só depois vi a
 * segunda — extraído aqui pra próxima vez que esse padrão aparecer
 * (e apareceria de novo) ser reaproveitar, não copiar pela terceira
 * vez.
 *
 * Genérico o bastante pra qualquer lista de opções (não só duas),
 * mas o uso real do app hoje é sempre com 2.
 */
/**
 * PORTE DO WEB (2026-09-09, a pedido — "você esqueceu de implementar o
 * 'Minha lista e Em breve' igual ao web; quando está o Em breve
 * selecionado, mudar de cor para azul").
 *
 * Duas coisas estavam diferentes do `HomeTabs.tsx`/`ExploreTabs.tsx`
 * do web:
 *
 *   TRILHA — era `colors.surface` chapado. No web é vidro:
 *   `rounded-full border border-white/10 p-1 backdrop-blur-[10px]
 *   backdrop-saturate-[160%]` sobre `radial-gradient(...0.13...), 0.06`
 *   — a receita `light` do `Glass`, a mesma da pílula de título de
 *   seção.
 *
 *   CÁPSULA — era `colors.primary` chapado. No web é a pílula "gel"
 *   (degradê + reflexo no topo + sombra interna embaixo + borda
 *   `white/15`), a MESMA dos botões âmbar do app.
 *
 * E a cor da cápsula muda por aba: âmbar no padrão, AZUL quando a aba
 * ativa é "Em breve". O comentário do web explica o porquê — "Em
 * breve" é sobre o que ainda vai chegar, não sobre o que já se
 * acompanha. Como este componente é genérico (Explorar também usa), a
 * decisão de qual tom fica com quem chama, via `tone`.
 */
export function SlidingTabs<T extends string>({
  options,
  active,
  onChange,
  tone = "amber",
}: {
  options: { value: T; label: string }[];
  active: T;
  onChange: (value: T) => void;
  /** Cor da cápsula ativa. `blue` é o que o web usa na aba "Em breve". */
  tone?: "amber" | "blue";
}) {
  const receita = tone === "blue" ? gelBlue : gel;
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = options.findIndex((o) => o.value === active);

  const capsuleAnim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    if (activeIndex < 0) return;
    Animated.timing(capsuleAnim, { toValue: activeIndex, duration: motion.normal, useNativeDriver: true }).start();
  }, [activeIndex, capsuleAnim]);

  const itemWidth = (trackWidth - TRACK_PADDING * 2) / (options.length || 1);
  const capsuleTranslate = capsuleAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * itemWidth),
  });

  return (
    <Glass
      style={styles.track}
      variant="light"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && activeIndex >= 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.capsule,
            {
              width: itemWidth,
              transform: [{ translateX: capsuleTranslate }],
              /*
                A BORDA DO BOTÃO, literal (2026-09-09, a pedido — "pegue
                o mesmo design no botão e aplique, sem assumir").
              
                Eu tinha posto `rgba(255,255,255,0.15)`, o valor do CSS
                do web. Errado aqui: o botão "Ver detalhes" NÃO usa isso
                no mobile — usa quatro cores OPACAS, uma por lado, que
                são o resultado já composto, medido contra o print. Uma
                borda com alfa compõe com o que está ATRÁS da cápsula (o
                vidro da trilha), não com o gel, e sai acinzentada.
              
                Agora as duas leem do mesmo lugar: `gel.border` /
                `gelBlue.border` em `lib/theme.ts`.
              */
              borderTopColor: receita.border.top,
              borderBottomColor: receita.border.bottom,
              borderLeftColor: receita.border.left,
              borderRightColor: receita.border.right,
            },
          ]}
        >
          {/* As três camadas do "gel", na mesma ordem do `GelSurface` (`Glass.tsx`). */}
          {/*
            A versão CALIBRADA do "gel", a pedido — "no HomeTabs o design
            é o mesmo do botão VER DETALHES". Aquele botão é o
            `GelSurface` com `webCalibrated`, que usa 4 paradas em
            gradiente VERTICAL puro e NÃO leva a lavagem branca por cima
            (o web não tem essa lavagem — só a linha de 1px no topo, que
            aqui é a borda `white/15` da cápsula).
          */}
          <LinearGradient
            colors={receita.gradientCalibrated}
            locations={receita.gradientCalibratedLocations}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <LinearGradient
            colors={[receita.insetBottom, "rgba(0,0,0,0)"]}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0.55 }}
            style={styles.capsuleInsetBottom}
          />
        </Animated.View>
      )}
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)} style={styles.tabItem}>
          <Text variant="label" style={active === option.value ? styles.labelActive : styles.label}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  /** `backgroundColor`/borda saíram: quem desenha é o `Glass` (receita `light`). `p-1` do web = 4 = `TRACK_PADDING`. */
  track: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: radius.full,
    padding: TRACK_PADDING,
  },
  capsule: {
    position: "absolute",
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    borderRadius: radius.full,
    /* A cor vem da receita, por lado — ver o comentário na `Animated.View`. */
    borderWidth: 1,
    /* Recorta os degradês no raio da cápsula — mesma estrutura do `gelWrap` do botão. */
    overflow: "hidden",
  },
  /** `inset 0 -4px 7px` do web — a sombra interna que dá o relevo embaixo. Fica DENTRO da borda, como no CSS. */
  capsuleInsetBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 11,
  },
  tabItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: colors.muted,
  },
  labelActive: {
    color: colors.background,
    fontWeight: "700",
  },
});
