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
    // CORREÇÃO (2026-09-16, achado pelo usuário — "abro uma lista do
    // Explorar tipo 'Filmes em alta' e em vez da grade de 3 colunas
    // aparece 1 card gigante") — `style` nunca era passado pro
    // `Pressable` de fora, só pro `Animated.View` de dentro. Não fazia
    // diferença nos usos com largura em PIXELS fixos (`DiscoverCarousel.tsx`,
    // `AddToLibraryButton.tsx`, `PosterGrid.tsx` — todos calculam um
    // número width antes, então o `Animated.View` já nascia do tamanho
    // certo mesmo sem o pai colaborar). Mas `DiscoverGridScreen.tsx`
    // usa `flex: 1` pra dividir a fileira da `FlatList` em 3 colunas
    // iguais — e `flex` só funciona no filho que participa de verdade
    // do layout flex do pai (a `Row` da FlatList), que é o `Pressable`
    // em si, não um `View` escondido dentro dele. Sem o `flex: 1`
    // chegar no `Pressable`, a fileira não tinha como dividir em 3 —
    // o 1º pôster crescia até tomar a largura toda disponível (por
    // isso o efeito de "carrossel" com o pôster seguinte só
    // espiando pela borda, mesmo sendo uma grade de verdade por
    // baixo).
    //
    // `style` agora vai pro `Pressable` (onde o layout do PAI enxerga
    // de verdade) e o `Animated.View` fica só com `flex: 1` (pra
    // preencher o `Pressable` inteiro) + a animação de escala — sem
    // mudar nada visualmente nos usos com largura fixa.
    //
    // BUG REAL CORRIGIDO (2026-10-09, reportado com print — botão
    // primário de `Button.tsx` ["Compartilhar link" do
    // `SharePreviewSheet`] aparecia quase invisível, só uma lasca da
    // borda dourada do `GelSurface` espiando por cima do botão
    // seguinte) — CAUSA RAIZ: `flex: 1` neste `Animated.View` cresce a
    // partir de uma base ZERO (`flexBasis: 0%`, é o que `flex: 1`
    // realmente significa), preenchendo só o espaço EXTRA que sobrar
    // no pai. Nos usos documentados acima (grade/carrossel) isso nunca
    // deu problema porque o `Pressable` (pai direto) sempre recebe uma
    // largura/altura JÁ DEFINIDA de fora (px fixo ou `flex: 1` numa
    // `Row` com altura certa) — sempre sobra "espaço disponível" pra
    // esse `flex: 1` preencher. Mas aqui o botão primário ficou, pela
    // primeira vez, dentro de uma coluna comum sem altura definida
    // (`SharePreviewSheet.tsx`, `actions`, tamanho "automático" = do
    // tamanho do conteúdo) — sem altura do pai pra "sobrar" espaço
    // nenhum, o Yoga (motor de layout do React Native) colapsa esse
    // `flex: 1` pra quase zero, mesmo o `GelSurface` por dentro já
    // pedindo no mínimo 48px (`minHeight: 48` em `Button.tsx`) — o
    // conteúdo acaba cortado/espremido em vez de simplesmente assumir
    // o próprio tamanho.
    //
    // Trocado por `alignSelf: "stretch"`: continua preenchendo a
    // LARGURA/ALTURA do `Pressable` quando ele já tem um tamanho certo
    // vindo de fora (mesmo efeito visual de sempre nos usos de
    // grade/carrossel/perfil), mas sem depender de "espaço extra
    // sobrando" pra existir — quando o pai não define tamanho nenhum
    // (caso novo do botão primário), o conteúdo simplesmente dita o
    // próprio tamanho, em vez de colapsar.
    <Pressable
      {...props}
      style={style as object}
      onPressIn={(e) => {
        animateTo(scaleTo);
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        animateTo(1);
        props.onPressOut?.(e);
      }}
    >
      <Animated.View style={{ alignSelf: "stretch", transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
