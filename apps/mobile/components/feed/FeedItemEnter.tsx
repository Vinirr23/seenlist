import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { motion } from "@/lib/theme";

const STAGGER_STEP_MS = 50;
/** Acima deste índice, sem atraso nenhum — evita que um item que surge só depois de MUITA rolagem (bem longe do topo) espere uma fila de atraso acumulado à toa. */
const STAGGER_MAX_INDEX = 5;

/**
 * A PEDIDO — "Feed mais vivo", item 4. Porta fiel do efeito CSS do
 * web (`.feed-item-enter` em `globals.css`) usando `Animated`
 * (núcleo do React Native, sem dependência nova). Dispara só na
 * MONTAGEM do componente — como cada post usa `key={post.id}`
 * (estável), o React só desmonta/remonta de verdade um post que
 * NUNCA existiu na lista antes; um post que já estava lá não
 * re-anima só porque uma curtida foi atualizada.
 *
 * ESCALONADO (2026-10-01, documento de UX — "os primeiros cards
 * entram com fade + translateY, escalonados por poucos milissegundos")
 * — `index` opcional (posição na lista): os primeiros
 * `STAGGER_MAX_INDEX` itens entram em sequência, 50ms um depois do
 * outro; a partir daí, sem atraso (senão rolar rápido até o meio da
 * lista faria um item esperar um atraso gigante só por causa da
 * posição dele). Sem `index` (quem não passa nada), continua idêntico
 * a antes — sem atraso nenhum.
 */
export function FeedItemEnter({ children, index }: { children: React.ReactNode; index?: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    const delay = index !== undefined && index <= STAGGER_MAX_INDEX ? index * STAGGER_STEP_MS : 0;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: motion.normal, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: motion.normal, delay, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispara só na montagem, de propósito (ver comentário acima); `index` não deve reabrir a animação se mudar por algum motivo.
  }, []);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
