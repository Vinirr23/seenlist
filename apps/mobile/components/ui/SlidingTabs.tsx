import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "./Text";
import { Glass } from "./Glass";
import { colors, gel, gelBlue, radius, spacing, motion, fontSize } from "@/lib/theme";

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

  /**
   * CAUSA RAIZ DE VERDADE, FECHADA COM QUATRO PRINTS REAIS (PT/EN ×
   * cada aba ativa) (2026-09-17 — terceira volta neste mesmo trecho).
   * A rodada anterior (comentário logo abaixo, mantido pra histórico)
   * tinha revertido pra divisão uniforme (`w-[calc(50%-4px)]` do web)
   * achando que era essa a causa raiz do "sem margem direita". Print
   * real provou o oposto: com a cápsula em metade fixa da trilha mas
   * cada `Pressable` com largura PELO PRÓPRIO CONTEÚDO (`tabItem` não
   * tem `flex:1` nem largura fixa — "My List" e "Coming up" têm
   * tamanhos bem diferentes), o texto ativo não fica mais dentro da
   * mesma caixa que a cápsula desenha — daí o texto "desalinhado" pra
   * a esquerda em inglês (a diferença de largura é grande) e quase
   * imperceptível em português (as duas abas têm larguras mais
   * próximas ali, mascarando o mesmo problema).
   *
   * A regra (duas opções possíveis, só uma pode valer ao mesmo tempo):
   *   (a) abas de largura IGUAL (`flex:1` cada) → cápsula em metade
   *       fixa, texto centralizado na própria metade;
   *   (b) abas por CONTEÚDO (o que `tabItem` sempre foi, aqui e no
   *       web — nem lá nem aqui o botão usa `flex:1`) → a cápsula tem
   *       que seguir a posição/largura REAIS da aba ativa, não uma
   *       fração fixa da trilha.
   * Como as abas são (e sempre foram) por conteúdo, a opção certa é a
   * (b) — exatamente o que a rodada de 2026-09-16 tinha implementado
   * (`itemLayouts`/`onLayout`), antes de eu reverter achando (errado)
   * que isso divergia do web. O web TEM o mesmo risco (`w-[calc(50%-
   * 4px)]` também não força os botões a 50%) — só não aparece tão
   * claro lá pelas mesmas larguras de texto PT/EN não terem sido
   * comparadas lado a lado. Reproduzir a fórmula exata do web não
   * ajuda se o resultado visual diverge; o que importa é texto e
   * fundo ocuparem a MESMA caixa.
   *
   * Fix de raiz (de volta): medir `x`/`width` reais de cada `Pressable`
   * via `onLayout` (dispara de novo sozinho quando o idioma muda o
   * tamanho do texto — sem offset manual por idioma) e usar essas
   * medidas pra cápsula, não mais uma fração da trilha.
   *
   * CORREÇÃO (2026-09-17, print real — "o fundo inteiro está deslocado
   * pra direita nos três idiomas") — a frase abaixo ("`x` já vem
   * relativo à área de CONTEÚDO do pai, exclui o padding") ESTAVA
   * ERRADA, e foi exatamente essa suposição errada que causou o
   * deslocamento: `x` de um `Pressable` de fluxo normal já vem
   * relativo à BORDA DE FORA do `track` (ou seja, já inclui o
   * `TRACK_PADDING`) — mas a cápsula é `position: absolute`, e um
   * filho absoluto tem `left` relativo à borda de DENTRO do padding do
   * pai. Somar `translateX(x)` a um `left: TRACK_PADDING` contava o
   * padding duas vezes. Detalhe completo, com a conta, no comentário
   * em cima de `positions`/`widths`, mais abaixo.
   */
  const [itemLayouts, setItemLayouts] = useState<{ x: number; width: number }[]>([]);
  function handleItemLayout(index: number, x: number, width: number) {
    setItemLayouts((prev) => {
      const next = [...prev];
      const atual = next[index];
      if (atual && atual.x === x && atual.width === width) return prev;
      next[index] = { x, width };
      return next;
    });
  }

  /**
   * CAUSA RAIZ DE VERDADE DO RESTO DO BUG, ACHADA COM O TERCEIRO IDIOMA
   * (2026-09-17 — print real em espanhol: "Mi Lista" vs "Próximamente",
   * a maior diferença de comprimento das três línguas). A medida real
   * por aba (acima) estava certa — mas eu deixava a cápsula aparecer
   * ANTES dela existir, caindo num FALLBACK aproximado (`trackWidth /
   * N`, uma divisão igual). Esse fallback é exatamente a mesma conta
   * errada da rodada anterior (metade da trilha) — só que agora só
   * aparecia por uma janela curta, entre a trilha medir a própria
   * largura e cada `Pressable` terminar de medir a própria. Em
   * português/inglês essa janela é imperceptível (as duas abas têm
   * largura parecida, o fallback quase acerta); em espanhol
   * ("Próximamente" bem mais longo) o fallback erra grosseiramente — a
   * cápsula de "Mi Lista" (metade da trilha) fica bem mais larga que o
   * texto real, invadindo a aba vizinha. Print reproduziu essa janela
   * de forma consistente o bastante pra deixar de ser "só um frame".
   *
   * Fix de raiz: a cápsula só aparece quando `medidasCompletas` for
   * verdadeiro — ou seja, só depois que TODAS as abas já mediram a
   * própria caixa de verdade. Sem fallback aproximado nenhum: melhor
   * a cápsula demorar um frame a mais pra aparecer do que aparecer
   * com o tamanho errado. Também: ao trocar de idioma, o TEXTO muda
   * mas os `Pressable`s eram os MESMOS componentes montados — nada
   * garantia que a medida antiga (do idioma anterior) fosse
   * descartada antes da nova chegar. Agora, toda vez que o conjunto de
   * rótulos muda (`labelsKey`), `itemLayouts` é zerado de propósito —
   * a cápsula some e só volta quando as medidas do idioma NOVO
   * chegarem, nunca com a geometria do idioma anterior.
   */
  const labelsKey = options.map((o) => o.label).join("␟");
  useEffect(() => {
    setItemLayouts([]);
  }, [labelsKey]);

  /**
   * CAUSA RAIZ DE VERDADE DO DESLOCAMENTO HORIZONTAL, CONFIRMADA
   * (2026-09-17 — hipótese do usuário: "o padding do contêiner está
   * sendo contado duas vezes"). Estava. `event.nativeEvent.layout.x`
   * de um `Pressable` IRMÃO (fluxo normal, não `position: absolute`)
   * já vem relativo à borda externa do `track` — ou seja, pra o
   * primeiro `Pressable`, `x` já é ≈ `TRACK_PADDING` (é onde ele
   * REALMENTE começa a ser desenhado, depois do padding do pai). Até
   * aqui bate com o comentário antigo (removido agora).
   *
   * O que esse comentário antigo errava: a CÁPSULA não é um
   * `Pressable` de fluxo normal — é `position: "absolute"`. Pra um
   * filho absoluto, `left`/`top` do RN (igual ao CSS) são relativos à
   * borda de DENTRO do padding do pai (a "padding box"), não à borda
   * de fora — ou seja `left: TRACK_PADDING` (o valor antigo, em
   * `styles.capsule`) já colocava a cápsula `TRACK_PADDING` pra
   * DENTRO da borda de fora, na prática outros `TRACK_PADDING` além
   * do que o próprio padding do pai já dá de graça pra um filho
   * absoluto. Somando o `translateX(x)` (que já carrega esse mesmo
   * `TRACK_PADDING` por vir do `Pressable` de fluxo normal), o
   * `TRACK_PADDING` entrava DUAS VEZES na posição final — exatamente
   * a hipótese do usuário, confirmada.
   *
   * Fix de raiz: `left` da cápsula volta a 0 (deixa o próprio
   * `position: absolute` respeitar o padding do pai sozinho, do jeito
   * que o RN já faz — mesmo princípio que `top`/`bottom: TRACK_PADDING`
   * já usava certo, sem nenhum `translateY` competindo com eles) e o
   * `x` medido de cada aba tem o `TRACK_PADDING` subtraído antes de
   * virar `translateX` — cancela exatamente a parcela que o `left`
   * absoluto já contribui sozinho. As LARGURAS (`widths`, abaixo) não
   * tinham esse problema — só a posição.
   */
  const medidasCompletas = itemLayouts.length === options.length && itemLayouts.every(Boolean);
  /*
   * CORREÇÃO DE CAUSA RAIZ (2026-09-17, typecheck real —
   * "itemLayouts[i] is possibly undefined", por causa do
   * `noUncheckedIndexedAccess`) — `medidasCompletas` já garante em
   * RUNTIME que todo índice existe (`.every(Boolean)`, logo acima),
   * mas o TypeScript não consegue amarrar essa garantia a um booleano
   * separado dentro do `.map` — pro tipo, `itemLayouts[i]` continua
   * `T | undefined` mesmo dentro do ramo `medidasCompletas ? ... `.
   * Ler o item numa variável e checar ELA diretamente (em vez de só
   * checar `medidasCompletas`) deixa o TypeScript enxergar a garantia
   * no mesmo lugar em que ela é usada — sem mudar o resultado (`0`
   * exatamente nos mesmos casos de antes).
   */
  const positions = options.map((_, i) => {
    const layout = medidasCompletas ? itemLayouts[i] : undefined;
    return layout ? layout.x - TRACK_PADDING : 0;
  });
  const widths = options.map((_, i) => {
    const layout = medidasCompletas ? itemLayouts[i] : undefined;
    return layout ? layout.width : 0;
  });
  const capsuleWidth = activeIndex >= 0 ? widths[activeIndex] : 0;

  const capsuleAnim = useRef(new Animated.Value(activeIndex)).current;
  useEffect(() => {
    if (activeIndex < 0) return;
    Animated.timing(capsuleAnim, { toValue: activeIndex, duration: motion.normal, useNativeDriver: true }).start();
  }, [activeIndex, capsuleAnim]);

  const capsuleTranslate = capsuleAnim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: positions,
  });

  return (
    <Glass
      style={styles.track}
      variant="light"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {trackWidth > 0 && activeIndex >= 0 && medidasCompletas && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.capsule,
            {
              width: capsuleWidth,
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
      {options.map((option, index) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout;
            handleItemLayout(index, x, width);
          }}
          style={styles.tabItem}
        >
          <Text variant="label" style={active === option.value ? styles.labelActive : styles.label}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </Glass>
  );
}

/**
 * HISTÓRICO desta mesma trilha, três voltas (fica registrado pra não
 * repetir o ciclo): (1) 2026-09-16 — divisão uniforme trocada por
 * medida real por aba, motivada por um sintoma que na verdade era o
 * peso de fonte 600/700 diferente (`label`/`labelActive`, abaixo).
 * (2) 2026-09-17, manhã — revertido pra divisão uniforme (`50%-4px`
 * do web), lendo o CSS do web ao pé da letra sem confirmar com print
 * lado a lado PT×EN. (3) 2026-09-17, com quatro prints reais — a
 * medida real por aba (voltou, ver o comentário de causa raiz dentro
 * de `SlidingTabs`, acima) é a certa: as abas são por CONTEÚDO (nunca
 * teve `flex:1`, nem aqui nem no web), então só a medida real garante
 * que texto e cápsula ocupem a mesma caixa nas duas línguas.
 */
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
    /**
     * CAUSA RAIZ DO DESLOCAMENTO HORIZONTAL, CONFIRMADA (2026-09-17 —
     * ver o comentário completo em cima de `positions`/`widths`, no
     * corpo de `SlidingTabs`). Era `TRACK_PADDING`, igual ao `top`/
     * `bottom` logo abaixo — parecia simétrico, mas não é: `top`/
     * `bottom` não competem com nenhum `translateY`, enquanto `left`
     * competia com `translateX(x)`, e `x` (medido no `Pressable`
     * irmão) já carrega o `TRACK_PADDING` sozinho. Filho `position:
     * absolute` já é posicionado relativo à borda DE DENTRO do padding
     * do pai — `left: 0` já respeita o padding sozinho, sem precisar
     * repetir `TRACK_PADDING` aqui (a mesma conta que `x` teve o
     * `TRACK_PADDING` subtraído antes de virar `translateX`).
     */
    left: 0,
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
  /** `px-4 py-1.5` do web (`HomeTabs.tsx`) — `py-1.5` = 6, estava `spacing.xs` (4). */
  tabItem: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  /**
   * CAUSA RAIZ DE VERDADE (2026-09-16, terceira rodada — o print
   * mostrou que o `lineHeight` sozinho NÃO resolveu, mesmo com a
   * cápsula já corrigida). Eu tinha ficado só no sintoma (as duas
   * caixas de texto tinham alturas diferentes) sem checar o web pra
   * ver se aquela diferença de peso (600/700) deveria existir.
   *
   * Não deveria: `HomeTabs.tsx` do web usa a MESMA classe
   * (`text-xs font-bold`) pras duas abas, ativa e inativa — a
   * ÚNICA diferença entre elas é a COR (`text-background` vs
   * `text-muted`). O mobile inventou uma diferença de peso que o web
   * nunca teve — `label` (aba inativa) ficava sem `fontWeight`
   * (herdava o 600 do `variant="label"` do `Text`), `labelActive`
   * pedia 700. Cada peso resolve pra um ARQUIVO DE FONTE diferente
   * (`fontFamilyForWeight`, `PlusJakartaSans_600SemiBold` vs
   * `_700Bold`) — dois arquivos de uma família não são garantidos ter
   * a mesma métrica vertical (ascent/descent/line-gap) mesmo com
   * `lineHeight` travado igual nos dois, porque o RN centraliza o
   * texto dentro da caixa usando o BASELINE do arquivo de fonte por
   * trás, que pode diferir entre pesos.
   *
   * Fix de raiz: as duas abas pedem o MESMO peso (700, igual ao
   * `font-bold` do web nas duas) — sem troca de arquivo de fonte
   * entre os estados, não tem baseline pra desalinhar. `lineHeight`
   * continua travado (não faz mal, só deixa de ser a única defesa).
   */
  /**
   * TAMANHO (2026-09-16, mesma comparação com o web) — `text-xs` do
   * Tailwind é 12/16 (`fontSize`/`line-height`), não os 14 do
   * `variant="label"` do `Text` (herdado por padrão). `16` aqui é o
   * `line-height: 1rem` padrão do PRÓPRIO `text-xs` do Tailwind, não
   * o `20` "genérico" que eu tinha posto antes sem checar o web.
   */
  label: {
    color: colors.muted,
    fontSize: fontSize.xs,
    fontWeight: "700",
    lineHeight: 16,
  },
  labelActive: {
    color: colors.background,
    fontSize: fontSize.xs,
    fontWeight: "700",
    lineHeight: 16,
  },
});
