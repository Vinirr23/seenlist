import { useEffect, useRef, useState } from "react";
import { Animated, Easing, type StyleProp, type TextStyle } from "react-native";
import { Text } from "./Text";

/**
 * MICRO-INTERAÇÃO (a pedido, 2026-10-01 — "deixar o app mais animado,
 * tipo Duolingo") — número sobe de 0 até o valor final quando aparece,
 * em vez de já aparecer pronto. Primeiro uso: os 4 números do
 * `StatisticsCard` do Perfil.
 *
 * `formatter` recebe o valor BRUTO arredondado a cada quadro da
 * animação (não o valor final já formatado) — permite tanto um número
 * simples (`numberFormatter.format`) quanto uma duração que muda de
 * unidade no meio da contagem (`formatWatchDuration(minutos, t).primary`
 * — "0 horas" → "3 dias" → ... → "1 ano", reaproveitando a mesma função
 * que já formata o valor final, sem duplicar a lógica de unidades).
 *
 * `Animated` (não Reanimated) de propósito — mesmo padrão já usado em
 * `ConfettiBurst.tsx`: o valor exibido é TEXTO, que só pode ser
 * atualizado no lado JS (`useNativeDriver: false` é obrigatório aqui,
 * não dá pra rodar isso na UI thread).
 */
export function CountingNumber({
  value,
  formatter,
  style,
  numberOfLines,
  duration = 900,
}: {
  value: number;
  formatter: (n: number) => string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  duration?: number;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const listenerId = animatedValue.addListener(({ value: v }) => {
      setDisplayValue(Math.round(v));
    });
    const animation = Animated.timing(animatedValue, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
      animatedValue.removeListener(listenerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {formatter(displayValue)}
    </Text>
  );
}
