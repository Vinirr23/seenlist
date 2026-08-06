import { useRef } from "react";
import { Animated, Pressable, type PressableProps } from "react-native";
import { motion } from "@/lib/theme";

/**
 * A PEDIDO (auditoria — micro-interações) — achado real: o app não
 * tinha NENHUM feedback de toque. Tocar num pôster, num botão de
 * marcar episódio ou no "+" de adicionar à biblioteca não dava
 * retorno visual nenhum — a tela só mudava (ou não, se a ação fosse
 * silenciosa), e a pessoa ficava sem saber se o toque "pegou". O web
 * já tinha isso (`active:scale-90` em `AddToLibraryButton.tsx`), o
 * mobile não.
 *
 * Encolhe levemente enquanto o dedo está pressionado e volta ao
 * soltar. `useNativeDriver` mantém a animação na thread de UI — não
 * trava nem quando o JS está ocupado buscando dados, que é
 * justamente quando o toque acontece.
 *
 * Substitui `Pressable` sem mudar mais nada: mesmas props.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.94,
  ...props
}: PressableProps & { scaleTo?: number; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  function animateTo(value: number) {
    Animated.timing(scale, {
      toValue: value,
      duration: motion.fast,
      useNativeDriver: true,
    }).start();
  }

  return (
    <Pressable
      {...props}
      onPressIn={(e) => {
        animateTo(scaleTo);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View style={[style as object, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
