import { createContext, useContext, useRef, type ComponentType, type ReactNode, type RefObject } from "react";
import {
  View,
  Image,
  StyleSheet,
  PixelRatio,
  Platform,
  useWindowDimensions,
  type ViewProps,
  type StyleProp,
  type ViewStyle,
  type ImageSourcePropType,
} from "react-native";
import { BlurView, BlurTargetView, type BlurViewProps } from "expo-blur";

/**
 * CORREÇÃO DE CAUSA RAIZ (2026-09-17, typecheck real — "Property
 * 'applyNoise' does not exist on type ... Readonly<BlurViewProps>",
 * na linha que usa `<BlurView applyNoise={...} />` abaixo) —
 * `applyNoise` é uma prop NATIVA real, só que não faz parte do
 * `expo-blur` publicado: foi adicionada por um patch local direto no
 * código nativo Android do pacote (ver o comentário grande em
 * `lib/theme.ts`, na interface `GlassVariant` — `ExpoBlurView.kt`/
 * `BlurModule.kt`, criada durante a investigação do grão de
 * dithering no `Dimezis/BlurView`, com a tela de diagnóstico
 * `debug-grain.tsx`, já removida). O patch mexe no código nativo, mas
 * nunca tocou no tipo `BlurViewProps` do pacote — que também não deve
 * ser editado à mão (dentro de `node_modules`, refeito a cada `pnpm
 * install`), nem dá pra estender por "declaration merging"
 * (`BlurViewProps` é um `type` no pacote, não uma `interface` — só
 * interface é mesclável).
 *
 * `PatchedBlurView` é um alias de tipo só pra este componente: o
 * MESMO `BlurView`, em runtime, só que o TypeScript passa a aceitar
 * `applyNoise` nele também — sem precisar de `as any` em cada prop.
 */
const PatchedBlurView = BlurView as unknown as ComponentType<BlurViewProps & { applyNoise?: boolean }>;
import { LinearGradient } from "expo-linear-gradient";
import { colors, glass, gel, glassVariants, type GlassVariant, type GlassVariantName } from "@/lib/theme";

/**
 * DIAGNÓSTICO TEMPORÁRIO (2026-09-16, a pedido — "rolagem dá umas
 * travadas" no Android, aparelho físico, sensação GERAL, não numa
 * tela específica).
 *
 * HIPÓTESE: o `BlurView` do `expo-blur` no Android
 * (`dimezisBlurViewSdk31Plus`) já é documentado neste arquivo como
 * caro (ver o histórico de "grão"/`blurMethod`, mais abaixo, no
 * `Glass()`) — e a barra de navegação (`DockNavegacao.tsx`) desfoca o
 * CONTEÚDO DA TELA INTEIRA, AO VIVO, em TODA tela do app, o tempo
 * todo (inclusive durante o gesto de rolar). Some a isso o `PosterGrid`/
 * `SeasonAccordion`, que montam um `Glass`/`BlurView` POR ITEM, todos
 * de uma vez (sem `FlatList`, sem desmontar o que está fora da tela).
 * A soma disso é a suspeita pra uma lentidão sentida no app INTEIRO,
 * não amarrada a uma tela só.
 *
 * ESTE FLAG desliga o blur DE VERDADE em TODO `Glass` do app, só no
 * Android (mantém o véu de cor translúcida — já testado antes, ver o
 * comentário "TESTE 2" dentro do `BlurView`, mais abaixo: "o grão
 * SOME junto com o blur" quando `blurMethod="none"`) — é só pra
 * ISOLAR a causa num build de teste, não é a correção final. Se a
 * rolagem ficar lisa com isto ligado, confirma a hipótese e o próximo
 * passo é decidir ENTRE pausar o blur durante o gesto de rolar (mais
 * fiel visualmente, mais trabalho) OU virar as listas pra `FlatList`
 * virtualizada (resolve o acúmulo de itens, não o custo da barra).
 * Se a rolagem CONTINUAR travando com isto ligado, a causa é outra
 * coisa, não o blur — e essa outra causa ainda está em aberto.
 *
 * REVERTER (voltar pra `false`) assim que o teste acontecer, esteja o
 * resultado confirmando ou derrubando a hipótese.
 */
const DIAGNOSTICO_BLUR_DESLIGADO_ANDROID = true;

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
 * 1. `GlassTargetProvider` — desenha o fundo a ser borrado (por
 *    padrão, o `AmbientGlow` abaixo) dentro de uma `BlurTargetView`,
 *    numa camada absoluta SEPARADA, atrás do conteúdo real da tela.
 *    Guarda a ref num Context pra os cards `Glass` acharem o alvo sem
 *    precisar passar por prop em cada um.
 * 2. `Glass` — o card em si (`BlurView`), sai pegando a ref do
 *    Context. Cai pra uma borda simples sem blur se usado fora de um
 *    `GlassTargetProvider` (não deveria acontecer, mas não quebra).
 * 3. `AmbientGlow` — manchas de cor de propósito atrás do conteúdo. Sem
 *    uma camada de cor atrás, o vidro não tem o que mostrar — o fundo
 *    do app é escuro e quase liso. Desde 2026-09-03 (comentário na
 *    própria função, abaixo) cada mancha é uma IMAGEM já desfocada de
 *    verdade, não mais uma forma com borda em degradê.
 *
 * CORREÇÃO (causa raiz do crash em Perfil, confirmada por evidência
 * dupla: o log nativo do Android — pilha de ~500 chamadas repetidas
 * entre `RenderNode::prepareTreeImpl`/`SkiaDisplayList::prepareListAndChildren`
 * terminando em `signal 11` (Segmentation fault) — e a doc oficial do
 * expo-blur, https://docs.expo.dev/versions/latest/sdk/blur-view/,
 * cujo próprio exemplo mostra `BlurView` sempre IRMÃO da
 * `BlurTargetView`, nunca filho dela) — a versão anterior deste
 * arquivo colocava TODO o conteúdo da tela (incluindo os próprios
 * cards `Glass`/`BlurView`) DENTRO da `BlurTargetView`. Isso cria uma
 * dependência circular na árvore de renderização nativa: montar a
 * `BlurTargetView` dependia de montar o `BlurView` filho, que por sua
 * vez dependia da `BlurTargetView` já montada — um ciclo que nunca
 * fecha, estoura a pilha e derruba o processo. Agora a
 * `BlurTargetView` só envolve o `background` (o que deve ser
 * borrado), como camada `position: absolute` atrás de tudo; os cards
 * `Glass` ficam em `children`, fora da `BlurTargetView`, como sempre
 * deveriam ter ficado.
 */
const GlassTargetContext = createContext<RefObject<View | null> | null>(null);

/**
 * LUZ ATRAVESSANDO O VIDRO (2026-09-09, a pedido — "no web os cards
 * glass se iluminam com o fundo e no mobile não").
 *
 * MEDIDO nos prints, no card "Animes", lado esquerdo (onde há mancha
 * atrás): web `rgb(42,73,106)`, azul; mobile `rgb(59,63,64)`, cinza. E
 * o fundo LOGO ABAIXO do card era, nos dois, praticamente igual — ou
 * seja não faltava luz atrás, faltava a luz ENTRAR.
 *
 * O que o web tem e o mobile não: `backdrop-saturate(180%)`. Ele
 * multiplica a cor do que está atrás — onde há azul, dobra o azul;
 * onde está neutro, não faz nada. Por isso o card "acende" só na parte
 * que tem mancha atrás.
 *
 * Por que NÃO dá pra compensar com véu (testado no número antes de
 * escrever isto): pra acertar o lado claro eu precisaria de um véu
 * `rgba(0,94,178,0.25)`, que no lado ESCURO do mesmo card levaria
 * `rgb(34,39,48)` (valor do web) pra `rgb(43,74,93)`. Véu é aditivo e
 * uniforme; saturação é multiplicativa e local. Não se trocam.
 *
 * O que reproduz: projetar o PRÓPRIO campo de manchas dentro do card.
 * O provider guarda aqui o nó de fundo que está desenhando; cada
 * `Glass` mede onde está na janela e redesenha esse mesmo campo
 * deslocado por essa posição, recortado pelo card. Resultado: forte
 * onde há mancha atrás, nulo onde não há — que é o comportamento do
 * `saturate`, e não um degradê fixo carimbado em todo card.
 */
const GlassLightContext = createContext<ReactNode>(null);

/** Dentro de um card, o dither não se repete (a camada de fundo já o tem). */
const InsideGlassContext = createContext(false);

/**
 * Quanto da luz do fundo é reinjetada. 1 = uma segunda cópia, que é o
 * que o `saturate(180%)` faz na prática com a cor de trás (dobra a
 * distância dela ao cinza).
 */
const GLASS_LIGHT_THROUGH = 1;

/**
 * TENTATIVA REVERTIDA (2026-09-02 — "o fundo não tem blur, coloque o
 * blur igual web") — testado um `BlurView` NOVO de tela cheia aqui,
 * irmão de `BlurTargetView` (mesmo padrão seguro documentado no
 * histórico deste arquivo, sem aninhar), pra desfocar de verdade as
 * manchas de cor nos espaços ENTRE os cards `Glass` (que antes só
 * ficavam com cara de vidro quando algum card estava sobreposto).
 *
 * ACHADO REAL, com print do usuário depois de testar (não teoria) — em
 * vez de desfocar só as manchas de fundo, essa camada borrou a TELA
 * INTEIRA, inclusive coisa que não tem nada a ver com o `background`
 * do `GlassTargetProvider` (a foto de capa lá em cima, texto, tudo) —
 * ficou tudo com um véu branco/cinza por cima, ilegível. Ou seja, na
 * prática, o `blurTarget` não restringiu o blur só ao conteúdo da
 * `BlurTargetView` como a doc sugere — capturou mais do que devia.
 * Como não dá pra testar ao vivo daqui pra investigar mais fundo
 * agora, e o resultado real deixou a tela pior (menos legível) do que
 * antes, a camada foi REMOVIDA — prioridade é não quebrar a
 * legibilidade do app de verdade. Os ajustes que FICARAM (confirmados
 * como melhoria, não regressão): `tint="light"` no `Glass` (cards) logo
 * abaixo, e as 8 manchas de fundo corretas em `profile.tsx`. Se
 * quiser tentar de novo o blur de tela cheia, precisa de alguém
 * testando ao vivo (não só trocar valor e torcer) — não tentar de novo
 * sem esse acompanhamento.
 */
export function GlassTargetProvider({
  children,
  style,
  background = <AmbientGlow />,
  base = DITHER_COMPENSATED_BASE,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** O que fica atrás do conteúdo e é o que o blur efetivamente mostra. Padrão: `AmbientGlow`. Passe `null` pra tela sem manchas de cor. */
  background?: ReactNode;
  /**
   * Cor de base DENTRO do alvo do blur (ver o comentário no JSX). Padrão:
   * o fundo escuro do app — é o que replica "a página já composta" que o
   * `backdrop-filter` do web amostra.
   *
   * Use `"transparent"` quando este provider NÃO cobrir a tela inteira e
   * sim flutuar sobre conteúdo (caso da barra de navegação): ali uma base
   * opaca deixaria o elemento sólido, matando justamente a translucidez.
   */
  base?: string;
}) {
  const targetRef = useRef<View>(null);
  return (
    <View style={style}>
      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {/*
         * CAUSA RAIZ (2026-09-04, print real mobile × web — "os cards
         * ficam cinza e o glow azul do fundo some dentro deles").
         *
         * No web, o `backdrop-filter` de cada card amostra a PÁGINA JÁ
         * COMPOSTA: o fundo escuro do app COM os glows azuis pintados
         * por cima. Aqui, a `BlurTargetView` recebia só o
         * `AmbientGlow` — manchas sobre TRANSPARÊNCIA, sem base
         * nenhuma. Desfocar uma camada quase toda transparente devolve
         * quase nada: o que sobrava dentro do card era só o véu branco
         * de 10% da receita sobre o escuro do app. Isso é, literalmente,
         * cinza — e explica por que o azul não atravessava o card.
         *
         * Com a base escura aqui dentro, o blur passa a amostrar
         * "escuro + azul", igual ao web.
         */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: base }]} />
        {background}
      </BlurTargetView>

      {/*
       * HIPÓTESE DERRUBADA (2026-09-09) — aqui existiu, por uma versão,
       * uma SEGUNDA cópia do `background` desenhada fora da
       * `BlurTargetView`. A ideia era que o buffer offscreen do
       * `expo-blur` fosse o responsável pelos anéis concêntricos que
       * apareciam nas manchas de fundo.
       *
       * O TESTE DE ISOLAMENTO derrubou isso (ver o comentário no topo de
       * `app/lists/index.tsx`): com fundo escuro + UMA mancha, sem
       * `BlurTargetView`, sem `BlurView`, sem `Glass`, sem nada por
       * cima, os anéis apareceram igual. Então a camada dupla foi
       * removida — ela só dobrava o custo de desenho sem corrigir nada.
       *
       * A causa real é a quantização de saída da tela numa rampa escura
       * (na faixa escura o aparelho tem ~2 níveis de vermelho, ~10 de
       * verde e ~23 de azul), e a correção ficou onde nasce: dither
       * ordenado embutido nas texturas — ver `GLOW_DISCS`.
       */}
      <GlassTargetContext.Provider value={targetRef}>
        <GlassLightContext.Provider value={background}>{children}</GlassLightContext.Provider>
      </GlassTargetContext.Provider>
    </View>
  );
}

export interface GlassProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  /**
   * Qual das 5 receitas de vidro do web usar (ver `glassVariants` em
   * `lib/theme.ts`, com a contagem de uso real de cada uma). Padrão
   * `"card"` — a receita de CARTÃO do web (0.17/0.10), que é o que a
   * maioria dos usos de `Glass` aqui é. Chip/linha usam `"light"`,
   * botão-círculo sobre imagem usa `"icon"`, dropdown/sheet usa
   * `"dark"`.
   */
  variant?: GlassVariantName;
  /**
   * ALVO DE DESFOQUE EXPLÍCITO (2026-09-09) — normalmente o `Glass`
   * pega o alvo do `GlassTargetContext` (o fundo da tela em que ele
   * está). A barra de navegação é a exceção: ela precisa desfocar a
   * `BlurTargetView` que envolve o CONTEÚDO da tela, criada em
   * `app/(tabs)/_layout.tsx`, que não é o alvo do contexto dela.
   *
   * É prop, e não um `Context.Provider` novo montado por fora (que era
   * a primeira versão): exportar o contexto quebrou em runtime com
   * "Cannot read property 'Provider' of undefined" — o binding novo não
   * chegou ao bundle. Uma prop em componente que já existe não depende
   * de export novo nenhum e, se algum dia não chegar, o pior caso é a
   * barra ficar sem desfoque, não a tela morrer.
   */
  blurTarget?: RefObject<View | null>;
  /**
   * MOLDURA DE VIDRO (2026-09-04) — segunda leitura de perímetro, logo
   * por DENTRO da borda externa. Opt-in por enquanto: só o card de
   * Estatísticas usa, até aprovação.
   *
   * O CSS do web NÃO tem camada de rim (conferido: sem `::before`, sem
   * `outline`, sem `ring`, sem view absoluta — só `border-white/10`,
   * a sombra externa e duas sombras internas). Mesmo assim o perímetro
   * dele lê como moldura e o do mobile não. Medido no pixel, atravessando
   * a borda de cima:
   *
   *              fora    borda   dentro
   *     web       57      229      128     <- borda mais clara que os DOIS lados
   *     mobile   163      142       57     <- borda mais ESCURA que o lado de fora
   *
   * No web a borda cai sobre a página escura, e o degrau é enorme. Aqui
   * ela cai sobre o campo de manchas, que é claro naquela região — o
   * mesmo branco 10% quase não gera contraste, e o anel some.
   *
   * A moldura resolve isso sem tocar no fundo (que está aprovado) nem
   * engrossar a borda: uma `View` de 1px encostada por dentro, com o
   * topo claro e a base escura — os mesmos valores do `inset 0 1px 0` e
   * do `inset 0 -1px 0` do web. Como é uma BORDA (e não uma barra
   * absoluta), ela acompanha o raio e se dissolve nos cantos — que foi
   * exatamente o problema da `View` reta removida antes.
   */
  rim?: boolean;
}

/**
 * Converte a geometria de um `radial-gradient` do web na caixa da
 * imagem de brilho equivalente.
 *
 * Numa `radial-gradient(RX% RY% at CX% CY%, cor, transparent S%)`, os
 * dois primeiros valores são os RAIOS da elipse final (em % da largura
 * e da altura da caixa) e `transparent S%` corta em S% desse raio —
 * então o brilho VISÍVEL tem raio `S/100 × RX` da largura e
 * `S/100 × RY` da altura, centrado em (CX%, CY%). A caixa da imagem é
 * o dobro disso, deslocada pra manter o mesmo centro. O `Glass` tem
 * `overflow: "hidden"`, então o que passa da borda é recortado — igual
 * ao CSS faz.
 */
/**
 * Imagem de brilho já desfocada de verdade (blur gaussiano aplicado
 * nos pixels, fora do app). Usada em DOIS papéis neste arquivo: o
 * brilho radial de canto de cada `Glass` e as manchas do
 * `AmbientGlow` — ver o comentário longo em `AmbientGlow`, mais
 * abaixo, pra causa raiz de por que não dá pra usar `LinearGradient`.
 * Declarada aqui em cima porque o `Glass` (logo abaixo) já a usa.
 */
const GLOW_IMAGE = require("../../assets/images/glow-soft.png");

/*
 * A COR do véu de vidro (o `base` de cada receita) foi calibrada por
 * medição de pixel contra o web e aprovada no aparelho em 2026-09-04 —
 * a conta completa, com as duas zonas medidas, está em `lib/theme.ts`,
 * em cima de `glassVariants`. Aqui só se aplica o valor.
 */

function highlightBox(v: GlassVariant) {
  const radiusX = (v.highlightStop / 100) * v.highlightRadiusX;
  const radiusY = (v.highlightStop / 100) * v.highlightRadiusY;
  return {
    left: `${v.highlightCenterX - radiusX}%` as const,
    top: `${v.highlightCenterY - radiusY}%` as const,
    width: `${radiusX * 2}%` as const,
    height: `${radiusY * 2}%` as const,
  };
}

/**
 * Card em "vidro" — usar no lugar de um `View` com `colors.surface` +
 * `colors.border` sempre que o card estiver dentro de um
 * `GlassTargetProvider` (telas ainda não convertidas continuam com o
 * visual antigo até a vez delas, por escolha — "tela a tela").
 */
export function Glass({ style, children, variant = "card", rim = true, blurTarget, ...props }: GlassProps) {
  /* `useContext` roda SEMPRE (regra dos hooks); a prop só tem prioridade depois. */
  const alvoDoContexto = useContext(GlassTargetContext);
  const target = blurTarget ?? alvoDoContexto;
  const recipe = glassVariants[variant];
  const highlight = highlightBox(recipe);
  /*
   * MOLDURA (`rim`) DESLIGADA NA COR DO FIO (2026-09-09, medido).
   *
   * Ela clareava o topo (0.10 → 0.22) e escurecia a base (0.10 → 0.04).
   * Existia porque o fio era pintado sobre o FUNDO da tela, e assim
   * saía escuro demais; a moldura compensava isso à mão. Agora o fio é
   * a última camada, por cima do vidro — igual ao `background-clip:
   * border-box` do CSS — e o web, medido, usa a MESMA cor nos quatro
   * lados: `branco 10%` sobre o interior do card, seja no topo, no lado
   * ou na base. A compensação virou desvio.
   *
   * A prop `rim` continua existindo e ainda controla a linha de brilho
   * interna de baixo (`insetShineBottom`, mais abaixo).
   */

  // A cor de véu calibrada mora no `base` de cada receita (`lib/theme.ts`).
  // No iOS, reforçada — ver o comentário completo em `boostAlphaOnIOS`.
  const baseColor = boostAlphaOnIOS(recipe.base);

  /**
   * `backdrop-saturate(180%)` — CAUSA RAIZ do "os cards glass não se
   * iluminam com o fundo igual ao web" (2026-09-09).
   *
   * Medido dentro do card de Estatísticas, na mesma faixa sem texto,
   * do lado que fica sobre a mancha (canal B):
   *
   *     web     49 ... 103        (variação 55)
   *     mobile  49 ...  77        (variação 29)
   *
   * O fundo LOGO FORA do card bate nos dois (medido: as margens
   * laterais das duas telas ficam a 2–3 níveis uma da outra). Ou seja
   * não é a luz que falta chegar no card — é o card que não AMPLIFICA
   * a luz. O que o web tem e faltava aqui é o `backdrop-saturate-[180%]`
   * que acompanha o `backdrop-blur-[18px]` em toda superfície de vidro
   * dele: ele afasta cada canal do cinza (`C' = L + 1.8·(C − L)`), então
   * quanto MAIS colorido o fundo atrás, mais forte o efeito — é
   * exatamente isso que faz o card "acender" em cima da mancha e ficar
   * neutro fora dela. Um véu uniforme não reproduz isso (já provado
   * numericamente numa tentativa anterior: o que consertava o lado
   * iluminado estourava o lado escuro do MESMO card).
   *
   * POR QUE PRECISOU REORGANIZAR A ÁRVORE: `filter` no RN vale pra view
   * E PRA TODA A SUBÁRVORE dela. Com `{children}` dentro do `BlurView`
   * (como era), saturar o desfoque saturaria junto o conteúdo do card —
   * e o âmbar do botão "VER DETALHES", que acabou de ser aprovado,
   * ficaria mais laranja. Agora o `BlurView` é uma CAMADA de fundo
   * absoluta, sem filhos, e o conteúdo é irmão dela por cima. O
   * `filter` pega só o desfoque, que é o que `backdrop-filter` quer
   * dizer.
   *
   * Efeitos colaterais tratados na mesma mudança:
   *   - a caixa (borda/raio/sombra) passou pra uma `View` comum. A
   *     sombra EXTERNA continua funcionando (era o único `boxShadow`
   *     que o teste de 2026-09-03 aprovou) e some o problema documentado
   *     de o blur nativo cobrir a sombra do próprio elemento.
   *   - `backgroundColor` que o CHAMADOR passa (ex.: o destaque âmbar do
   *     card de recomendações não lidas) era pintado POR CIMA do
   *     desfoque, porque o `BlurView` era o elemento estilizado. Numa
   *     `View`, `backgroundColor` pinta ATRÁS dos filhos — sumiria
   *     debaixo do blur. Por isso ele é extraído do estilo e redesenhado
   *     como camada, na mesma ordem de antes.
   *   - A BORDA VIRA CAMADA (2026-09-09, medida a pedido — "no web tem
   *     uma borda de vidro em todos os cards, perceptível; no mobile
   *     não"). No CSS o `background`/`backdrop-filter` vale até a caixa
   *     de BORDA (`background-clip: border-box` é o padrão), então a
   *     borda do web é `branco 10%` por cima do PRÓPRIO vidro do card:
   *
   *         fundo   pixel da borda   interior
   *         web  26        80            59      (59 × 0.9 + 25.5 = 78)
   *         mob  28        47            58      (28 × 0.9 + 25.5 = 50)
   *
   *     No mobile a borda pertence à `View` de fora, e `View` pinta a
   *     borda ATRÁS dos filhos — ou seja o vidro parava na caixa de
   *     padding e a borda ficava sobre o fundo cru. Resultado: no web a
   *     borda é MAIS CLARA que o interior, aqui era mais ESCURA.
   *
   *     Fix: o vidro volta a chegar na caixa de borda (inset negativo) e
   *     a borda vira a ÚLTIMA camada, desenhada por cima dele. A `View`
   *     de fora mantém `borderWidth` (é o que reserva o espaço no
   *     layout) com cor transparente.
   */
  const estiloAchatado: ViewStyle = StyleSheet.flatten<ViewStyle>(style) ?? {};
  const {
    backgroundColor: fundoDoChamador,
    borderColor: bordaDoChamador,
    borderTopColor: bordaTopoDoChamador,
    borderBottomColor: bordaBaseDoChamador,
    borderLeftColor: bordaEsqDoChamador,
    borderRightColor: bordaDirDoChamador,
    ...estiloSemFundo
  } = estiloAchatado;
  const larguraBorda = typeof estiloAchatado.borderWidth === "number" ? estiloAchatado.borderWidth : 1;
  /* A camada da borda ocupa exatamente a caixa de BORDA — 1px pra fora da de padding. */
  const caixaDeBorda = {
    position: "absolute",
    top: -larguraBorda,
    left: -larguraBorda,
    right: -larguraBorda,
    bottom: -larguraBorda,
  } as const;
  /**
   * O FIO DE VIDRO. Fica na caixa de PADDING, não na de borda — e isso
   * é o que faz ele aparecer: o `overflow: "hidden"` da caixa de fora
   * recorta tudo que passa da área de desenho, e uma camada com inset
   * negativo vive INTEIRA fora dela. Foi assim que a primeira versão
   * desta camada sumiu por completo no aparelho.
   *
   * Desenhado por último, então fica por cima do vidro — que é o que o
   * `background-clip: border-box` do CSS faz. Confere com o web:
   *
   *     lado esquerdo   interior 61 → fio 81   (61 × 0.9 + 25.5 = 80)
   *     base            interior 54 → fio 75   (54 × 0.9 + 25.5 = 74)
   *
   * COR IGUAL NOS QUATRO LADOS, sem a variação por lado da moldura
   * (`rim`). Os dois números acima são o mesmo `branco 10%` aplicado a
   * interiores diferentes — o web não clareia o topo nem escurece a
   * base. A moldura foi criada quando o fio era pintado sobre o FUNDO
   * (e por isso saía escuro demais); com ele sobre o vidro, ela vira
   * compensação de um problema que não existe mais.
   */
  const camadaDeBorda: ViewStyle = {
    ...StyleSheet.absoluteFillObject,
    borderWidth: larguraBorda,
    borderRadius: estiloAchatado.borderRadius,
    borderTopLeftRadius: estiloAchatado.borderTopLeftRadius,
    borderTopRightRadius: estiloAchatado.borderTopRightRadius,
    borderBottomLeftRadius: estiloAchatado.borderBottomLeftRadius,
    borderBottomRightRadius: estiloAchatado.borderBottomRightRadius,
    borderColor: bordaDoChamador ?? recipe.border,
    /* `border-dashed` existe no web (`EmptyShelf.tsx`); sem isto o tracejado ficaria na `View` de fora, cuja borda é transparente. */
    borderStyle: estiloAchatado.borderStyle,
    ...(bordaTopoDoChamador === undefined ? {} : { borderTopColor: bordaTopoDoChamador }),
    ...(bordaBaseDoChamador === undefined ? {} : { borderBottomColor: bordaBaseDoChamador }),
    ...(bordaEsqDoChamador === undefined ? {} : { borderLeftColor: bordaEsqDoChamador }),
    ...(bordaDirDoChamador === undefined ? {} : { borderRightColor: bordaDirDoChamador }),
    ...(bordaDoChamador === undefined ? {} : { borderColor: bordaDoChamador }),
  };

  return (
    <View
      style={[styles.wrap, estiloSemFundo, styles.bordaTransparente]}
      {...props}
    >
    {/*
      * CORREÇÃO (a pedido — "a barra de navegação do mobile não tem o
      * mesmo efeito do web, no mobile está quase opaca", 2026-09-15) —
      * DUAS causas, achadas em duas rodadas de teste ao vivo no
      * aparelho (não suposição — cada uma confirmada por print antes
      * de seguir pra próxima):
      *
      * 1. O `filter: [{saturate}]` vivia no `style` do `BlurView`
      *    (componente nativo de terceiros, `Dimezis/BlurView` por
      *    baixo, não a `View` padrão do RN) — nada garantia que o
      *    `ViewManager` dele reencaminhasse uma prop de estilo que ele
      *    não espera. Fix: esta `View` comum (garantida por doc)
      *    ENVOLVENDO o `BlurView`, em vez do `BlurView` receber o
      *    filtro direto. Isso satura a SAÍDA já composta do blur —
      *    igual ao `backdrop-saturate` do CSS, que também opera DEPOIS
      *    do blur, não antes.
      *
      * 2. Só isso ainda não mudava nada visível — teste com
      *    `filter: [{invert: 1}]` (rodada 1) provou que o mecanismo
      *    FUNCIONA de verdade nesta `View` (a barra ficou visivelmente
      *    creme/pêssego, o esperado ao inverter um fundo escuro
      *    azulado). Ou seja o problema real nunca foi "não chega no
      *    nativo" — foi MAGNITUDE: o `1.8` (cópia literal do `180%`
      *    CSS do web) é fraco demais pro jeito que o RN/Android
      *    calcula `saturate` nesta versão — não há garantia de que a
      *    escala bata 1:1 com o `backdrop-saturate` do navegador.
      *    Rodada 2, com `saturate: 6` só nesta barra, confirmou: ficou
      *    visivelmente MAIS colorida que o web (e um pouco
      *    desigual/em blocos, print comparado lado a lado) — então o
      *    número certo fica entre 1.8 (fraco demais) e 6 (forte
      *    demais/desigual). `dock.saturate` em `lib/theme.ts` virou
      *    `3.5` como primeira calibração real — segue precisando de
      *    confirmação visual no aparelho pra afinar pra cima ou pra
      *    baixo.
      */}
    <View
      pointerEvents="none"
      style={[caixaDeBorda, recipe.saturate === undefined ? null : { filter: [{ saturate: recipe.saturate }] }]}
    >
    <PatchedBlurView
      pointerEvents="none"
      blurTarget={target ?? undefined}
      /**
       * CORREÇÃO REVERTIDA (2026-09-16, mesmo dia — a tentativa anterior
       * aqui estava ERRADA, e o print do usuário depois do build provou
       * (barra continuou "quase legível" por trás, e os cards em geral
       * apareceram com a borda "linha fina" em vez do detalhe de vidro
       * do web — o mesmo sintoma em mais lugares, não só a barra).
       *
       * A tentativa anterior calculava `intensity ÷ blurReductionFactor`
       * também no iOS, supondo que esse fosse o "raio real" que faltava
       * lá. Errado: `blurReductionFactor` e essa conta inteira são a
       * correção de um bug ESPECÍFICO do `Dimezis/BlurView` (a lib
       * nativa ANDROID por baixo do `expo-blur` — ver o comentário
       * grande "CAUSA RAIZ DO LEITOSO" em `lib/theme.ts`, escrito a
       * partir do código-fonte real de `ExpoBlurView.kt`): aquela lib
       * pinta um véu branco (`overlayColor`) calculado a partir do
       * `intensity` CRU, e a única forma de manter o raio de desfoque
       * igual reduzindo esse véu é dividir os dois numa proporção fixa.
       * Isso não tem NENHUMA relação com o `BlurView` do iOS, que é o
       * `UIVisualEffectView` nativo da Apple — outro componente, outra
       * lib, sem `Dimezis` envolvido. Confirmado também na documentação
       * oficial do `expo-blur` (checada agora, com acesso à web): ela
       * descreve `blurReductionFactor` como "a number by which the blur
       * intensity will be divided ON ANDROID" — explicitamente do lado
       * Android, para aproximar o resultado do iOS, nunca o contrário.
       * Aplicar essa mesma conta no iOS multiplicava o número por até 6×
       * sem fundamento nenhum — o iOS voltou a receber `blurIntensity`
       * cru, sem nenhuma divisão platform-specific.
       *
       * CAUSA RAIZ ENCONTRADA (2026-09-16, mesmo dia, print seguinte —
       * "a barra voltou a ficar muito transparente e os botões ainda
       * estão bugados") — o revert acima resolveu o erro de fórmula,
       * mas trocou por outro problema: `recipe.blurIntensity` (o valor
       * CRU já dividido pra caber no véu do Android, ex.: `dock` em
       * `8.25`) nunca foi pensado pra ser um desfoque sozinho — só faz
       * sentido junto do `blurReductionFactor` (Android). Usado cru no
       * iOS, vira um desfoque quase nulo (a barra deixa passar cor E
       * detalhe quase sem tratamento nenhum) — não porque a fórmula
       * anterior estivesse "mais certa", mas porque este número, sem a
       * dupla, é baixo demais pra qualquer plataforma.
       *
       * Ver o comentário grande em `iosBlurIntensity`, na interface
       * `GlassVariant` (`lib/theme.ts`) — cada receita agora carrega um
       * raio PRÓPRIO pro iOS, fixo (não recalculado a partir do
       * `blurReductionFactor` do Android, que muda a cada rodada de
       * calibração de lá) e já extraído das rodadas de calibração
       * visual já feitas contra o print do web, antes de qualquer
       * redução que só o algoritmo Android precisou.
       */
      intensity={Platform.OS === "ios" && recipe.iosBlurIntensity !== undefined ? recipe.iosBlurIntensity : recipe.blurIntensity}
      /**
       * CORREÇÃO (2026-09-10, reportado — "o vidro no mobile tem
       * granulado, no web é liso") — causa raiz confirmada na
       * documentação oficial do `expo-blur`: no Android,
       * `blurMethod="dimezisBlurView"` (linha abaixo) desenha o
       * desfoque de verdade (não é o CSS `backdrop-filter` liso do
       * navegador) usando a biblioteca `Dimezis/BlurView` por baixo —
       * em aparelhos/emuladores sem a API `RenderNode` (Android 12+),
       * ela cai pro caminho antigo via `RenderScript`, que a própria
       * doc do Expo descreve como "much less efficient" e que, na
       * prática, amostra a imagem numa resolução reduzida e depois
       * amplia — é essa reamostragem que aparece como grão/ruído,
       * mais visível ainda sobre fundos escuros com foto (exatamente
       * o caso daqui). O parâmetro que existe pra ajustar isso é
       * `blurReductionFactor` (padrão 4 — divide a resolução em que o
       * blur é calculado antes de ampliar de volta; a própria doc
       * recomenda baixá-lo pra "aproximar mais do iOS").
       *
       * ACHADO (2026-09-10, 3 testes reais no emulador, não suposição)
       * — troquei `blurMethod` pra `"none"` (desliga o blur de
       * verdade): o grão SUMIU em TUDO, inclusive na barra de
       * navegação — prova que a causa é o algoritmo de blur, não o
       * emulador em geral. Troquei pra `"dimezisBlurViewSdk31Plus"`
       * (API nova do Android, `RenderNode`, só existe em Android 12+):
       * a barra de navegação ficou lisa (esse emulador roda Android
       * 12+, senão teria caído pra `"none"` igual ao teste anterior) —
       * MAS o resto (cards do Perfil, capa, grade de pôsteres) voltou
       * a mostrar grão.
       *
       * Causa provável dessa diferença: a barra de navegação desfoca
       * um degradê PRÓPRIO, simples e controlado
       * (`DockGlowBackground`, ver `DockNavegacao.tsx`) — não a tela
       * de verdade atrás dela. O resto do vidro desfoca conteúdo real
       * de alto detalhe (foto da capa, pôsteres) sobre tema escuro —
       * mais difícil pra QUALQUER blur do Android renderizar sem
       * banding/ruído, seja qual for o algoritmo. Ou seja: o grão que
       * sobra pode não ser mais sobre o algoritmo (já trocado pro
       * melhor disponível), e sim sobre RESOLUÇÃO do cálculo do blur.
       * Testando agora `blurReductionFactor={1}` (era 2) — remove
       * QUALQUER redução de resolução antes de desfocar (custo de
       * desempenho maior, mas isolando se ainda sobra grão sem
       * nenhuma reamostragem de por meio).
       *
       * VIROU POR RECEITA (2026-09-16, ver o comentário grande em
       * `blurReductionFactor` na interface `GlassVariant`,
       * `lib/theme.ts`) — lendo o `ExpoBlurView.kt` real (instalado,
       * versão `55.0.18`), achei que o `overlayColor` nativo (o véu de
       * cor que o `tint` pinta por cima do blur) usa o valor CRU da
       * prop `intensity`, sem dividir por `blurReductionFactor` — só o
       * raio de desfoque de verdade é que divide. Ou seja dá pra manter
       * o raio final (`intensity ÷ blurReductionFactor`) igual e ainda
       * assim reduzir o véu, baixando os dois na mesma proporção. Só o
       * `dock` usa isso por enquanto (é o único caso relatado como
       * "leitoso"); as outras receitas continuam com `1`, o valor de
       * sempre, pra não mexer em superfície já aprovada.
       */
      blurReductionFactor={recipe.blurReductionFactor ?? 1}
      /**
       * CORREÇÃO #2 (a pedido, 2026-09-02, com print real depois de
       * testar) — era `"dark"` (véu escuro por cima do blur, deixava
       * os cards "pintados de cinza" escuro). Trocado pra `"light"`
       * numa primeira tentativa — só que ficou forte DEMAIS na outra
       * direção: os números/legendas dos cards (que usam `colors.text`/
       * `colors.muted`, tons claros, pensados pra um fundo ESCURO)
       * ficaram com pouco contraste, quase ilegíveis, em cima de um véu
       * branco forte. O véu de `"light"`/`"dark"` do `expo-blur` não é
       * sutil como o `rgba(255,255,255,0.09-0.10)` quase transparente
       * que o web usa de base — é bem mais forte que isso nas duas
       * direções. SEM `tint` (igual ao ajuste que já funcionou na
       * camada de fundo, `GlassTargetProvider` acima) resolve os dois
       * problemas de uma vez: blur puro, sem escurecer nem clarear —
       * o `gradientNeutral` (branco bem sutil, logo abaixo) e as
       * camadas extra por card (`StatisticsCard.tsx`, pílulas do
       * Perfil) são a ÚNICA fonte de "luz" agora, igual ao web.
       */
      /**
       * TESTE 2 (2026-09-10) — o teste 1 (`blurMethod="none"`, ver
       * histórico) confirmou: o grão SOME junto com o blur (usuário
       * testou e reportou) — prova que a causa é mesmo o algoritmo
       * `dimezisBlurView` (`RenderScript`, ver comentário acima), não
       * o emulador em geral. `"none"` não é aceitável como fix final
       * (mata o vidro em TODO lugar que usa `Glass`, inclusive a barra
       * de navegação — foi só pra isolar a causa; o usuário notou
       * exatamente isso, "afetou a barra de navegação").
       *
       * Agora testando a alternativa de verdade: `"dimezisBlurViewSdk31Plus"`
       * usa a API NOVA do Android (`RenderNode`), sem o caminho
       * `RenderScript` que causa o grão — mas só existe a partir do
       * Android 12 (API 31); em qualquer aparelho/emulador MAIS VELHO
       * que isso, ela também cai pra `"none"` (sem blur nenhum, só o
       * véu semi-transparente — igual ao teste 1). Não sei a versão
       * do Android deste emulador, por isso é um teste, não uma
       * certeza: se aqui aparecer o vidro desfocado E liso, o
       * emulador é Android 12+ e este é o fix final; se aparecer
       * IGUAL ao teste 1 (sem desfoque nenhum, barra de navegação
       * "sem graça" de novo), o emulador é mais velho que isso, e
       * volta a ser uma escolha entre grão (`dimezisBlurView`) ou
       * sem-blur-em-Android-velho (`dimezisBlurViewSdk31Plus`).
       */
      blurMethod={DIAGNOSTICO_BLUR_DESLIGADO_ANDROID && Platform.OS === "android" ? "none" : "dimezisBlurViewSdk31Plus"}
      /**
       * TESTE AO VIVO (2026-09-16, "faça isso") — ver o comentário
       * grande em `applyNoise`, na interface `GlassVariant`
       * (`lib/theme.ts`). Passa a receita adiante; ausente = `true`
       * (padrão da lib, nenhuma mudança de comportamento). Só `card`
       * usa `false` por enquanto — `dock` e as outras receitas
       * continuam exatamente como estavam.
       */
      applyNoise={recipe.applyNoise ?? true}
      /*
       * CAUSA RAIZ ENCONTRADA (a pedido, 2026-09-16 — "compare o código
       * da barra web com o da barra mobile antes de alterar de novo").
       * Comparando as duas implementações lado a lado:
       *
       * O web (`BottomNavigation.tsx`) tem só TRÊS camadas por cima do
       * conteúdo: `backdrop-filter: blur(18px) saturate(180%)` (sample
       * o que está atrás, sem nenhuma cor própria), o `background`
       * do próprio elemento (o radial branco 17% + base branca 10% —
       * autorais, escritos à mão), e a borda. Não existe NENHUM véu
       * automático embutido no `backdrop-filter` do CSS — ele só
       * desfoca, ponto.
       *
       * O `BlurView` do `expo-blur`, ao contrário, tem uma camada a
       * MAIS que o CSS não tem: a doc oficial diz, literalmente,
       * "every tint adds a translucent color layer on top of the
       * blur. No value renders the blur alone" — ou seja QUALQUER
       * valor de `tint` (inclusive "dark", que estava aqui) pinta uma
       * camada de cor translúcida DIRETO NO NATIVO, por cima do blur,
       * ANTES de qualquer `style` do lado JS. O comentário antigo
       * deste arquivo assumia que `backgroundColor: transparent` no
       * `style` cancelava essa camada (citando o issue
       * expo/expo#30893, que é sobre o CSS `background` comum, não
       * sobre o véu que o PRÓPRIO `tint` desenha) — não tem evidência
       * de que isso tenha sido testado ao vivo depois de `tint="dark"`
       * ter sido reintroduzido, e a doc oficial contradiz a premissa.
       *
       * Isso bate com todos os sintomas relatados nesta rodada: a
       * barra sempre "errava pro escuro/acinzentado" (efeito
       * esperado de um véu escuro fixo), e nenhum ajuste de
       * `saturate`/`blurIntensity` no lado JS conseguia consertar de
       * vez — porque os dois operam DEPOIS dessa camada nativa, nunca
       * chegam a removê-la.
       *
       * FIX: tira o `tint` inteiro (nenhum valor, nem "default") — é
       * exatamente o que uma sessão anterior já tinha validado ao vivo
       * ("SEM tint... resolve os dois problemas de uma vez", comentário
       * histórico logo acima) antes de alguém reintroduzir `tint="dark"`
       * sem reconfirmar no aparelho. A cor do vidro passa a vir 100% do
       * `base`/`highlight` da receita (autorais, iguais ao `background`
       * do web) — igual à divisão de responsabilidade do CSS.
       */
      style={[
        styles.noBlurVeil,
        /*
         * CORREÇÃO (2026-09-09, medido a pedido — "no web tem uma borda
         * de vidro em todos os cards, perceptível; no mobile, se tiver,
         * não é perceptível").
         *
         * Esta camada tinha inset NEGATIVO de `-larguraBorda` nos quatro
         * lados. A intenção era não deixar um anel de 1px sem desfoque
         * por baixo da borda — mas filho pinta POR CIMA da borda do pai,
         * então ela estava APAGANDO a borda inteira. Medido na borda
         * esquerda do card de Estatísticas (excesso do pixel da borda
         * sobre o interior, canal B):
         *
         *     altura      35%   55%   75%   90%
         *     web         +16   +20   +26   +21
         *     mobile       +1    +1    +3    +3
         *
         * Volta pra caixa de padding (`absoluteFillObject`), que é por
         * dentro da borda. O anel de 1px que fica sem desfoque mostra o
         * fundo do app cru por baixo de um branco 10% — invisível, e
         * muito menos custoso que perder a borda.
         *
         * MUDANÇA (2026-09-15, ver o comentário grande na `View` de fora
         * que agora envolve este `BlurView`) — o `saturate` saiu daqui
         * (não é mais `caixaDeBorda`, é `StyleSheet.absoluteFillObject`
         * simples): a geometria de borda agora é da `View` wrapper, e
         * este `BlurView` só precisa preencher ELA por inteiro.
         */
        StyleSheet.absoluteFillObject,
      ]}
    />
    </View>
    {fundoDoChamador === undefined ? null : (
      <View style={[caixaDeBorda, { backgroundColor: fundoDoChamador }]} pointerEvents="none" />
    )}
    <>
      {/*
       * LUZ DENTRO DO CARD — TENTATIVA REVERTIDA (2026-09-09).
       *
       * A ideia (projetar aqui o campo de manchas deslocado pela posição
       * do card, pra reproduzir o `backdrop-saturate(180%)` do web)
       * continua certa, mas esta implementação estava errada por dois
       * motivos, e o primeiro derrubou a tela:
       *   1. `BlurView` não expõe `measureInWindow` — erro em runtime
       *      ("_caixaRef$current.measureInWindow is not a function").
       *   2. Mesmo com a ref numa `View`, a posição medida no layout
       *      fica ERRADA assim que a tela rola: as manchas são fixas na
       *      tela e o card rola. Precisa acompanhar o scroll, não uma
       *      medida única.
       * Refazer com essas duas coisas resolvidas antes de reativar.
       */}
      {/*
       * CORREÇÃO ESTRUTURAL (2026-09-04, a pedido — "não parece o mesmo
       * design system do web"; ver o levantamento completo das 5
       * receitas em `lib/theme.ts`, `glassVariants`) — aqui tinha UM
       * `LinearGradient` diagonal atravessando o card inteiro
       * (0.13 → 0.06). O web não faz isso: ele pinta uma BASE CHAPADA
       * e por cima um brilho RADIAL de canto que morre aos 60% da
       * caixa. A diferença não é de número, é de forma — com o degradê
       * linear, o card inteiro fica lavado; com base + glint de canto,
       * o corpo do card fica uniforme e escuro como no web (e o texto
       * `muted` por cima volta a ter o contraste que tem lá).
       *
       * As duas camadas abaixo são exatamente essas duas partes do
       * `background` do web, na mesma ordem: base primeiro, brilho
       * depois. O brilho usa o mesmo PNG pré-desfocado do `AmbientGlow`
       * (ver comentário longo lá embaixo) porque RN não tem
       * `radial-gradient` — e `stretch` porque os raios X e Y do web
       * são diferentes, ou seja é uma ELIPSE, não um círculo.
       */}
      {/*
       * A `View` em volta existe por um motivo de API, não de layout:
       * `pointerEvents` é prop de `View`, NÃO de `Image` (o
       * `ImageProps` do RN não tem essa propriedade — erro real de
       * `tsc`). Como ela é `absoluteFillObject`, tem exatamente a
       * mesma caixa do card, então as porcentagens do brilho continuam
       * resolvendo contra a mesma referência de antes. Mesmo padrão já
       * usado logo abaixo, nas linhas de brilho da borda.
       */}
      <View style={caixaDeBorda} pointerEvents="none">
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: baseColor }]} />
        <Image
          source={GLOW_IMAGE}
          resizeMode="stretch"
          style={{
            position: "absolute",
            left: highlight.left,
            top: highlight.top,
            width: highlight.width,
            height: highlight.height,
            tintColor: stripAlpha(recipe.highlight),
            opacity: alphaOf(recipe.highlight),
          }}
        />
      </View>
      {/*
       * CAUSA RAIZ ACHADA (2026-09-03, teste de diagnóstico com sombra
       * magenta/ciano gigante, print real do celular — Android 12,
       * então não é o limite de versão) — a sombra `inset` (as 2
       * camadas que dão o "brilho na borda" do vidro) nunca aparecia
       * porque estava no `boxShadow` do PRÓPRIO `BlurView` (`styles.wrap`,
       * abaixo) — e o `BlurView` desenha seu efeito de desfoque como uma
       * camada nativa que cobre TODA a área do card por CIMA de qualquer
       * `boxShadow` aplicado nele mesmo. A sombra EXTERNA escapa desse
       * problema por ficar FORA da caixa — testada com magenta, apareceu
       * perfeitamente.
       *
       * TENTATIVA 1 (revertida) — mover a sombra inset pra uma `View`
       * FILHA do `BlurView` (ainda usando `boxShadow`, só que num filho
       * em vez do próprio `BlurView`) continuou invisível num teste
       * seguinte com o app de verdade. Ou seja, o problema não era só
       * "em cima ou embaixo do blur" — sombra `inset` com `boxShadow`
       * (mesmo em elemento sem blur nenhum por perto) está se mostrando
       * pouco confiável nesta combinação de Expo/RN/dispositivo.
       *
       * FIX DEFINITIVO — abandona `boxShadow` pras sombras INTERNAS de
       * vez (a EXTERNA continua em `styles.wrap`, essa já provou
       * funcionar). Duas `View`s simples, com `backgroundColor` sólido,
       * 1px cada, uma colada no topo (brilho) e outra embaixo (sombra)
       * — a MESMA aparência final de um `inset` sem blur (que é
       * exatamente o que os 2 valores do web são: `inset 0 1px 0` e
       * `inset 0 -1px 0`, blur ZERO nos dois), só que com uma técnica
       * que não depende de nenhuma API nova — `backgroundColor` num
       * `View` funciona desde sempre, sem exceção.
       */}
      {/*
       * TESTE (2026-09-04, a pedido) — o reflexo de topo saiu DAQUI, não
       * teve a opacidade reduzida de novo.
       *
       * Motivo: `inset 0 1px 0` do CSS e uma `View` absoluta de 1px NÃO
       * são a mesma primitiva. No CSS a sombra interna é desenhada
       * dentro da caixa, recortada pelo raio da borda e fundida com ela;
       * a `View` é um retângulo sólido de ponta a ponta, que passa reto
       * por onde o canto arredondado deveria estar curvando. Por isso
       * ela lê como uma LINHA independente desenhada por cima — o
       * artefato continuou visível mesmo depois de o valor voltar ao
       * 0.16 real do web. Baixar mais a opacidade só deixaria a linha
       * mais fraca, sem deixar de ser uma linha.
       *
       * Ficando só a borda externa (`rgba(255,255,255,0.10)` nos quatro
       * lados, intocada). Se o vidro ficar chapado demais sem nenhum
       * reflexo, o próximo passo NÃO é voltar esta `View`, e sim um
       * degradê curto no topo (que não tem borda dura) ou aceitar que no
       * Android a borda sozinha já faz esse papel.
       *
       * A linha de BAIXO continua: ela é escura, some contra o fundo e
       * nunca foi reportada como artefato.
       */}
      {!rim && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={styles.insetShineBottom} />
        </View>
      )}
      {children}
      {/* Última camada: a borda por cima do vidro, como o `border-box` do CSS. */}
      <View style={camadaDeBorda} pointerEvents="none" />
    </>
    </View>
  );
}

export interface GelSurfaceProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  /**
   * CALIBRAÇÃO (2026-09-04) — corrige DUAS divergências medidas contra o
   * botão do web. Ainda opt-in: só o botão "Ver detalhes" do
   * `StatisticsCard` usa, até o usuário aprovar; depois vira padrão.
   *
   * 1. DIREÇÃO. O CSS do web é um `radial-gradient(130% 170% at 28% 18%)`
   *    — RADIAL. Ele foi portado como `LinearGradient` DIAGONAL, de
   *    (0.28,0.18) a (0.85,0.95). Num botão ~4× mais largo que alto, uma
   *    diagonal é dominada pelo eixo horizontal, e o resultado ficou
   *    girado ~90° em relação ao web. Medido no pixel (variação do canal
   *    R de ponta a ponta):
   *
   *      mobile   horizontal +45 (topo) / +61 (base)   vertical  +6 / +22
   *      web      horizontal +13        / +13          vertical +27 / +27
   *
   *    Ou seja: o web varia sobretudo de CIMA PRA BAIXO, com uma queda
   *    lateral leve.
   *
   *    TENTATIVA ERRADA, REGISTRADA PRA NÃO SE REPETIR: a primeira
   *    correção usou `start (0,0) → end (0.48,1)`, derivando o vetor da
   *    razão 13:27 entre as diferenças de canal medidas. Isso NÃO é uma
   *    equivalência válida — um radial elíptico não vira linear por essa
   *    conta, e pior: `start`/`end` são coordenadas NORMALIZADAS, então
   *    num botão de 129×35 um `x` de 0.48 vale ~62px contra ~35px de
   *    `y`. O eixo horizontal continuava dominando, e a rampa lateral
   *    permaneceu (medido depois: ~29-34 de variação horizontal contra
   *    ~6-7 do web).
   *
   *    Agora é VERTICAL PURO (`0.5,0 → 0.5,1`). Sem gradiente radial no
   *    RN, um vertical simples chega mais perto do web do que qualquer
   *    tentativa de simular a geometria radial: no web a leitura é
   *    "dourado ≈ dourado" na horizontal, com a queda acontecendo de
   *    cima pra baixo. Se sobrar alguma diferença lateral, ela entra
   *    depois e MUITO sutil — não voltando pro `x` grande.
   *
   * 2. UMA CAMADA A MAIS. O web tem só `inset 0 1px 0 rgba(255,255,255,0.35)`
   *    — uma LINHA de 1px no topo. O mobile desenhava essa linha
   *    (`gelInsetShineTop`) E TAMBÉM uma lavagem branca 0.35→0 cobrindo
   *    55% da altura (`gel.highlight`), que não existe no CSS. Era ela
   *    que deixava o topo em #EBB776 contra #D49848 do web.
   */
  webCalibrated?: boolean;
}

/**
 * "Gel" âmbar — OPACO, sem blur, pra CTA/pílula em destaque (não é
 * vidro: não precisa estar dentro de um `GlassTargetProvider`, funciona
 * em qualquer tela).
 */
export function GelSurface({ style, children, webCalibrated = false, ...props }: GelSurfaceProps) {
  /*
   * CAUSA RAIZ DA BORDA INVISÍVEL (2026-09-04, medido: a base do botão
   * ia de #A66826 direto pro fundo, sem pico claro, enquanto no web faz
   * #AD732B → #DAA964 → fundo).
   *
   * O `expo-linear-gradient` pinta o degradê por cima da ÁREA DA BORDA
   * da própria view — qualquer `borderWidth` posto nele fica encoberto.
   * Foi por isso que a borda não apareceu nem como estilo da view nem
   * como camada sobreposta (essa outra era comida pelo `overflow:
   * hidden` + raio 999, ver histórico).
   *
   * Agora a raiz é uma `View` comum, que carrega a borda, e o degradê
   * virou camada absoluta dentro dela. Filho absoluto no RN é
   * posicionado dentro da BORDA (padding box), então o degradê não a
   * alcança mais. O `style` de quem usa continua na raiz, então padding,
   * direção e raio do botão não mudam.
   */
  return (
    <View style={[styles.gelWrap, style]} {...props}>
      <LinearGradient
        colors={webCalibrated ? gel.gradientCalibrated : gel.gradient}
        locations={webCalibrated ? gel.gradientCalibratedLocations : gel.gradientLocations}
        // Ver `webCalibrated` — vertical puro.
        start={webCalibrated ? { x: 0.5, y: 0 } : { x: 0.28, y: 0.18 }}
        end={webCalibrated ? { x: 0.5, y: 1 } : { x: 0.85, y: 0.95 }}
        /*
         * CORREÇÃO (2026-09-09, medido no print — "no web o botão tem um
         * contorno que você não está colocando"): a linha de cima do
         * botão saía CINZA no mobile, `rgb(37,40,46)`, e no web sai
         * CREME, `rgb(221,180,129)`.
         *
         * Causa: o web usa `background-clip: border-box` — o degradê
         * âmbar é pintado TAMBÉM debaixo da borda, então o
         * `border-white/15` compõe branco sobre âmbar. No RN o filho
         * absoluto começa na borda INTERNA, e o mesmo branco 15%
         * compunha sobre o fundo escuro da tela.
         *
         * `gelUnderBorder` avança o degradê 1px pra fora de cada lado —
         * exatamente a espessura da borda. Nenhuma cor ou geometria
         * muda.
         */
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Ver `webCalibrated` — o web não tem esta lavagem, só a linha de 1px logo abaixo. */}
      {!webCalibrated && (
        <LinearGradient
          colors={gel.highlight}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.55 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      )}
      {/*
       * FIX DEFINITIVO (2026-09-03, mesma troca do `insetShine` do
       * `Glass` acima — ver comentário completo lá: `boxShadow` `inset`
       * se mostrou pouco confiável nesta combinação de Expo/RN, mesmo
       * movido pra uma `View` filha) — brilho de cima é uma linha sólida
       * de 1px (mesma técnica do `Glass`); sombra de baixo tinha
       * `blurRadius: 7` no valor original (um degradê suave, não uma
       * linha reta) — reproduzida com um `LinearGradient` desvanecendo
       * a mesma cor até transparente, de baixo pra cima, em vez de uma
       * linha sólida (mais fiel ao efeito "sombra suave" original que
       * `boxShadow`/blur tentava dar).
       */}
      <View style={styles.gelInsetShineTop} pointerEvents="none" />
      <LinearGradient
        colors={["rgba(120,66,10,0.4)", "rgba(120,66,10,0)"]}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0.55 }}
        style={styles.gelInsetShineBottom}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

/**
 * Diâmetros de mancha que o app usa — os mesmos do web (`h-64 w-64` =
 * 256, `h-60 w-60` = 240, e assim por diante). É uma UNIÃO FECHADA de
 * propósito: cada diâmetro tem a SUA imagem (ver `GLOW_DISCS`), então
 * inventar um tamanho novo sem gerar a imagem vira erro de compilação,
 * em vez de mancha sumida descoberta só no aparelho.
 */
export type GlowBlobSize = 160 | 176 | 192 | 224 | 240 | 256 | 260 | 300;

export type GlowBlob = {
  color: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: GlowBlobSize;
};

const BLOBS: GlowBlob[] = [
  { color: "rgba(232,163,61,0.5)", top: -60, left: -144, size: 260 },
  { color: "rgba(79,209,197,0.4)", top: 220, right: -170, size: 300 },
  { color: "rgba(232,163,61,0.32)", bottom: -40, left: -120, size: 240 },
];

/**
 * CORREÇÃO (2026-09-03, a pedido — testado ao vivo no celular físico,
 * comparado com print do web: "mancha não é desfocada, é um círculo
 * nítido. não tem efeito vidro") — causa raiz: cada mancha era uma
 * `LinearGradient` (cor → transparente) dentro de uma `View` com
 * `borderRadius: size/2`. Isso NÃO é um desfoque — é só uma forma
 * circular com preenchimento em degradê, com borda ainda perfeitamente
 * definida (o raio do círculo). Só ficava com cara de "borrão suave"
 * nos pontos em que um card `Glass` (que aí sim tem `BlurView` de
 * verdade) estava sobreposto por cima — em qualquer lugar visível
 * direto no fundo (sem card por cima), aparecia o círculo nítido
 * reportado.
 *
 * TENTATIVA MAIS ARRISCADA, DESCARTADA POR ORA — desfocar a mancha de
 * verdade com `BlurView`/`BlurTargetView` já foi tentada antes (ver
 * comentário "TENTATIVA REVERTIDA" no topo do arquivo) e borrou a tela
 * INTEIRA por engano; envolve mexer no mesmo mecanismo que já causou
 * um crash real. A pedido, o caminho tentado primeiro foi este mais
 * seguro: NÃO toca em `BlurView`/`BlurTargetView`/`Glass` — troca o
 * `LinearGradient` por uma imagem PNG que já nasce desfocada (blur
 * gaussiano de verdade aplicado nos pixels, fora do app, igual ao que
 * o `filter: blur()` do CSS faz no web) — `assets/images/glow-soft.png`,
 * um único brilho branco genérico. A cor de cada mancha (`blob.color`,
 * continua um `rgba(...)` normal) agora colore essa imagem via
 * `tintColor` (o RN usa o canal alpha da imagem como máscara e pinta
 * tudo com a cor pedida, preservando o degradê suave do alpha) — só
 * muda COMO a mancha é desenhada, a posição/tamanho/cor de cada uma
 * (`blobs`, `BLOBS`, `PROFILE_GLOW_BLOBS` em `profile.tsx`) continua
 * exatamente igual a antes. Se mesmo assim não ficar igual ao web
 * (o vidro dos cards por cima ainda pode continuar "chapado" se o
 * problema real estiver no `BlurView` em si, não nas manchas), o
 * combinado é escalar pra tentativa mais arriscada acima — com
 * acompanhamento ao vivo no celular, como o comentário lá em cima
 * exige.
 */
/**
 * AJUSTE (2026-09-03, a pedido, em duas rodadas — "as manchas agora
 * ficaram certas, mas estão muito escuras, aumenta uns 20% o brilho",
 * depois "aumenta mais 40%" — cada uma testada ao vivo no celular
 * físico antes da próxima) — como a mancha agora é uma imagem colorida
 * via `tintColor` (cor sólida, sem gradiente próprio), quem controla o
 * "brilho" percebido contra o fundo escuro é só o `opacity` final. Em
 * vez de regenerar a imagem ou mexer na cor de cada mancha
 * (`blob.color`, seguem intocadas — mesmos valores do web),
 * multiplica-se a opacidade original por este fator na hora de aplicar
 * — um só lugar pra ajustar "brilho geral" de novo no futuro, sem
 * precisar tocar em `BLOBS`/`PROFILE_GLOW_BLOBS` nem gerar imagem nova.
 * Fator acumulado: 1.2 (primeiro pedido) × 1.4 (segundo pedido) = 1.68.
 */
/**
 * REVERTIDO A 1 (2026-09-04, a pedido — "a cor das manchas do fundo e a
 * opacidade não são as mesmas do web, deixe igual ao web").
 *
 * Este reforço veio de uma sessão anterior, quando o usuário pediu
 * "+20%" e depois "+40%" (1.2 × 1.4 = 1.68) porque as manchas ficavam
 * escuras demais. Aquilo foi calibrado contra o vidro ANTIGO, claro e
 * lavado. Depois da calibração do material, o mesmo reforço deixou o
 * fundo do mobile visivelmente mais aceso que o do web.
 *
 * Mantido como constante (e não apagado) porque é o único lugar pra
 * mexer no "brilho geral" das manchas se um dia for preciso de novo.
 */
/**
 * AJUSTE VISUAL (2026-09-09, a pedido — "quero que foque em visual
 * ficar igual", depois de três rodadas em que igualar a CONTA do web
 * não mudou nada na tela).
 *
 * Por que existe um desvio deliberado aqui: com os discos exatos (ver
 * `GLOW_DISCS`) o campo do mobile fica a 1.4/255 do web no pior pixel.
 * Mesmo assim, no emulador ele continua lendo como "manchas pintadas".
 * O modelo do web foi validado contra o print real do web (RMS
 * 3.3/255), e o do mobile contra o print do mobile — ou seja, os dois
 * lados estão pintando o que o código manda; o que muda é a TELA em
 * que cada um é visto (o print do emulador tem o extremo escuro
 * esmagado numa escada de ~6 degraus, o do navegador não).
 *
 * Como o critério aqui é o olho do usuário, não o número, este fator
 * multiplica a opacidade de TODAS as manchas de fundo. 1 = exatamente
 * o web. Abaixo de 1 = mais discreto, que é a direção pedida
 * ("menos opacidade, menos contraste, transição mais longa").
 *
 * É de propósito UM número só, num lugar só: dá pra subir/descer sem
 * mexer em mancha, cor, posição ou imagem nenhuma.
 */
/*
 * 1 → 1.18 (2026-09-09, a pedido — "aumenta o brilho das manchas
 * também, igual ao web"). Medido no pico da mancha, canal azul: web
 * 73, mobile 65. Sobre a base 20 isso é +53 contra +45, ou seja o
 * mobile entregava 85% da luz. 53/45 = 1.18.
 */
const GLOW_BRIGHTNESS_BOOST = 1.13;

/*
 * DE VOLTA A 1 (2026-09-09) — este fator tinha ido pra 0.7 na tentativa
 * de "suavizar no olho" o que na verdade eram os ANÉIS descritos em
 * `GlassTargetProvider`. Diagnosticada a causa real (buffer de baixa
 * precisão), abaixar a opacidade deixou de fazer sentido: o campo volta
 * a ser exatamente o do web. A régua continua aqui — é um número só —
 * se o usuário quiser o fundo mais discreto que o web por gosto.
 */

/*
 * A função de saturação e a constante `WEB_BACKDROP_SATURATE` foram
 * REMOVIDAS em 2026-09-04 (a pedido — manchas iguais às do web). O
 * papel de compensar o `backdrop-saturate-[180%]` ficou com a cor do
 * véu dos cards (`glassVariants` em `lib/theme.ts`, azul em vez de
 * branco), que age só DENTRO do vidro — que é onde o web aplica.
 */

/**
 * Separa um `rgba(...)` em cor sólida + alpha — o `tintColor` do RN
 * pinta com a cor e ignora alpha, então o alpha precisa virar
 * `opacity` da própria imagem.
 */
function parseRgba(rgba: string): { rgb: string; alpha: number } {
  const match = rgba.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!match) return { rgb: rgba, alpha: 1 };
  const [, r, g, b, a] = match;
  return { rgb: `rgb(${r}, ${g}, ${b})`, alpha: a !== undefined ? parseFloat(a) : 1 };
}

/** Cor sólida de um `rgba(...)`, pra usar em `tintColor`. */
function stripAlpha(rgba: string): string {
  return parseRgba(rgba).rgb;
}

/** Alpha de um `rgba(...)`, pra usar em `opacity`. */
function alphaOf(rgba: string): number {
  return parseRgba(rgba).alpha;
}

/**
 * REFORÇO NO iOS (2026-09-16, primeira tentativa, ainda por confirmar
 * com print do próximo build) — ver o comentário grande no `BlurView`,
 * em `Glass()`, pra causa raiz completa: a fórmula `intensity ÷
 * blurReductionFactor` que "consertava" a barra no Android é
 * específica de um bug da lib nativa Android (`Dimezis/BlurView`) e não
 * tem nenhum efeito real no iOS — aplicá-la lá foi revertido.
 *
 * Em vez de continuar chutando o número de `intensity` do `BlurView`
 * (API nativa da Apple, sem visibilidade de código-fonte daqui, ao
 * contrário do Android), a primeira tentativa mexe numa peça bem mais
 * simples e previsível: o véu de cor sólida (`baseColor`, uma `View`
 * comum por cima do blur, SEM nenhuma API de blur envolvida) — reforça
 * o alfa dele só no iOS, deixando o Android intocado (já calibrado e
 * aprovado). Isso ataca os dois sintomas relatados juntos (barra
 * "quase legível" por trás E cards com borda "linha fina" em vez do
 * detalhe de vidro do web) porque os dois são, no fundo, "não tem
 * contraste suficiente contra o que está atrás" — um véu mais forte
 * ajuda nos dois, mesmo que o desfoque em si continue igual.
 *
 * `1.6` é um chute inicial (não medido em aparelho) — multiplica o
 * alfa calibrado sem passar de 1 (alfa cheio). Precisa de confirmação
 * visual no próximo build, e pode precisar subir ou descer.
 */
const IOS_BASE_ALPHA_BOOST = 1.6;
function boostAlphaOnIOS(rgba: string): string {
  if (Platform.OS !== "ios") return rgba;
  const { rgb, alpha } = parseRgba(rgba);
  const boosted = Math.min(1, alpha * IOS_BASE_ALPHA_BOOST);
  const [r, g, b] = rgb.match(/[\d.]+/g) ?? ["255", "255", "255"];
  return `rgba(${r}, ${g}, ${b}, ${boosted})`;
}

/**
 * Igual ao `parseRgba`, mas com o reforço de brilho das MANCHAS DE
 * FUNDO (ver `GLOW_BRIGHTNESS_BOOST`). O reforço vale só aqui: foi
 * calibrado no aparelho pras manchas grandes do fundo, e aplicá-lo ao
 * brilho dos cards deixaria o vidro mais claro que o web.
 */
function parseGlowColor(rgba: string): { tint: string; opacity: number } {
  const { rgb, alpha } = parseRgba(rgba);
  /*
   * A SATURAÇÃO EXTRA SAIU (2026-09-04, a pedido — "deixe igual ao web").
   * Ela existia pra compensar o `backdrop-saturate-[180%]` que o
   * `expo-blur` não tem, mas aplicada na ORIGEM ela também acendia as
   * manchas visíveis do fundo, que no web não são saturadas — só o que
   * passa POR TRÁS do vidro é. O papel de compensar a saturação ficou
   * com a cor do véu (`glassVariants`, azul em vez de branco), que age
   * só dentro dos cards, que é onde o web aplica.
   *
   * Agora a mancha sai com a cor e a opacidade literais do web.
   */
  return { tint: rgb, opacity: Math.min(1, alpha * GLOW_BRIGHTNESS_BOOST) };
}

/**
 * CAUSA RAIZ DEFINITIVA DAS MANCHAS (2026-09-09, a pedido — "as manchas
 * estão estouradas/recortadas, no web são difusas", depois de duas
 * tentativas anteriores de acertar por número que NÃO resolveram).
 *
 * Registro das duas tentativas erradas, pra ninguém repetir:
 *   1. `GLOW_SIZE_BOOST` (+40%, +70%) — % chutada, sem usar o número
 *      do web. Não converge por construção.
 *   2. `BLUR_VISIBLE_SPREAD_PX = 3 × 60` — espalhamento CONSTANTE.
 *      Diagnóstico certo (o blur vaza muito além da caixa), conta
 *      errada: o espalhamento não é constante.
 *   3. `glowBoxSize`/`glowAlphaScale` — caixa e opacidade ajustadas por
 *      mínimos quadrados ponderados por área. Melhorou o número e
 *      PIOROU a tela: o peso por área (2πr) puxa o ajuste pro rabo
 *      distante da mancha, então ele encolhia o miolo, que é justamente
 *      o que se enxerga.
 *
 * O que estava errado nas TRÊS: todas tentavam fazer UMA imagem de
 * perfil fixo (`glow-soft.png`, esticada) imitar o web. Não dá. O web
 * pinta `disco(D)` e aplica `filter: blur(60px)` — σ ABSOLUTO. Com σ
 * fixo e D variável, o perfil resultante MUDA de formato a cada
 * diâmetro (um disco de 256 sob σ=60 ainda tem topo quase chato, pico
 * 0.897; um de 160 já é quase uma gaussiana pura, pico 0.589). Uma
 * imagem só, esticada, entrega sempre o MESMO formato — então ou o
 * miolo ou o rabo sai errado, e mexer em opacidade/tamanho só troca
 * qual dos dois erra.
 *
 * FIX: parar de aproximar. Cada diâmetro tem a SUA imagem, gerada fora
 * do app com exatamente a conta que o navegador faz —
 * `disco(D) ∗ gaussiana(σ=60)` — e guardada com o alpha REAL (o pico
 * fica em 0.589…0.956 conforme o tamanho, não normalizado pra 1). Com
 * isso o mobile pinta `opacity` e `tintColor` literais do web, sem
 * nenhum fator de correção no meio.
 *
 * A imagem de cada mancha tem lado `D + 360` (os 3σ = 180px de
 * espalhamento visível de cada lado, já embutidos), e o alpha é zerado
 * fora do círculo inscrito — a caixa nunca tem canto quadrado.
 *
 * VERIFICADO renderizando os dois campos (as 8 manchas do Perfil sobre
 * `#0B0E14`, numa tela de 411×915) com a conta de cada lado:
 *
 *                        pico do azul   média   % da tela acima de B=40
 *   web                       76.7       36.2            36.4%
 *   mobile com PNG único      76.9       38.6            43.8%   <- acendia 1/5 a mais de tela
 *   mobile com estes discos   76.6       36.5            37.0%
 *
 *   diferença pixel a pixel contra o web:
 *     PNG único      → até 9.2/255 (média 1.51)
 *     discos exatos  → até 1.4/255 (média 0.17)
 *
 * (As tentativas de dither DENTRO da textura — 1x e @3x — foram
 * removidas: não sobrevivem à reamostragem. Ver `DitherLayer`.)
 *
 * POR QUÊ: a mancha é matematicamente contínua, mas a saída da tela
 * não é. Medido no aparelho, na faixa escura: ~2 níveis de vermelho,
 * ~10 de verde, ~23 de azul. Uma rampa de 290px de raio saía em 32
 * degraus — uma faixa a cada 9.1px, os anéis concêntricos reportados.
 * Nenhuma mudança de opacidade, tamanho, formato ou primitiva
 * (SVG/textura) resolveria: todas caem na mesma quantização no fim.
 *
 * O dither troca banda por granulado fino: pixels vizinhos caem em
 * níveis diferentes e o olho faz a média. ±0.04 de alpha equivale a
 * ±1.8 níveis de saída na mancha mais forte (opacidade 0.45) e ±1.4 na
 * mais fraca que aparece em tela (0.35) — o suficiente pra cobrir o
 * degrau medido, e abaixo do que se enxerga como textura.
 *
 * Bayer (ordenado) e não ruído aleatório por dois motivos: é periódico,
 * então o PNG comprime (435 KB no total em vez de ~2.5 MB), e não
 * cintila entre frames.
 *
 * Validado ANTES de subir, simulando a composição contra os níveis
 * REAIS medidos no print do aparelho: sem dither os anéis aparecem
 * iguais aos do print; com ±0.02 já somem; ±0.04 é a margem.
 *
 * `glow-soft.png` CONTINUA em uso — pelo brilho de canto dos cards
 * (`CARD_GLOWS`) e pelo brilho da aba ativa da barra
 * (`app/(tabs)/_layout.tsx`), que são outra geometria. Só o
 * `AmbientGlow` deixou de usá-la.
 */
const GLOW_DISC_PADDING_PX = 180; // 3σ do `blur(60px)` — já embutido em cada imagem

const GLOW_DISCS: Record<GlowBlobSize, ImageSourcePropType> = {
  160: require("../../assets/images/glow-disc-160.png"),
  176: require("../../assets/images/glow-disc-176.png"),
  192: require("../../assets/images/glow-disc-192.png"),
  224: require("../../assets/images/glow-disc-224.png"),
  240: require("../../assets/images/glow-disc-240.png"),
  256: require("../../assets/images/glow-disc-256.png"),
  260: require("../../assets/images/glow-disc-260.png"),
  300: require("../../assets/images/glow-disc-300.png"),
};

function growGlowBlob(blob: GlowBlob): {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
} {
  // A imagem já nasce com os 180px de espalhamento de cada lado; recuar
  // top/left/right/bottom pelo mesmo tanto mantém o CENTRO da mancha
  // exatamente onde o web coloca.
  const size = blob.size + GLOW_DISC_PADDING_PX * 2;
  return {
    top: blob.top !== undefined ? blob.top - GLOW_DISC_PADDING_PX : undefined,
    bottom: blob.bottom !== undefined ? blob.bottom - GLOW_DISC_PADDING_PX : undefined,
    left: blob.left !== undefined ? blob.left - GLOW_DISC_PADDING_PX : undefined,
    right: blob.right !== undefined ? blob.right - GLOW_DISC_PADDING_PX : undefined,
    size,
  };
}

/**
 * Campo de manchas de cor atrás do conteúdo — usado automaticamente
 * pelo `GlassTargetProvider` (prop `background`, ver acima) como o
 * que fica dentro da `BlurTargetView`. Também pode ser usado avulso
 * fora daqui. `pointerEvents="none"` pra nunca capturar toque.
 *
 * `blobs` (opcional) — a pedido ("perfil não se parece com o web"),
 * telas com uma paleta própria já decidida no web (ex.: Perfil, que
 * usa só tons de azul — ver `ProfileView.tsx` do web, comentário
 * "Vidro iluminado") passam o próprio array em vez de usar o padrão
 * âmbar/teal genérico daqui.
 */
/**
 * DITHER — CAUSA RAIZ E POR QUE AS TENTATIVAS ANTERIORES FALHARAM
 * (2026-09-09, medido no print do usuário da tela "Minhas listas", com
 * o web e o emulador lado a lado no MESMO screenshot).
 *
 * O QUE O APARELHO ENTREGA: ao longo do fundo, o canal azul só assume
 * os valores 20, 28, 34, 39, 43, 46, 50, 53, 56, 64, 72. Esses são,
 * exatamente, os valores sRGB de 2/255, 3/255, 4/255 … 16/255. Ou
 * seja: a janela do app é composta num buffer de 8 bits em LUZ LINEAR,
 * onde a faixa escura tem só ~10 códigos. O web, no mesmo screenshot e
 * no mesmo monitor, usa TODOS os inteiros de 20 a 40 — ele compõe em
 * sRGB. Não é o `expo-blur`, não é o formato da mancha, não é
 * opacidade: é o compositor.
 *
 * Com ~10 códigos disponíveis, uma rampa longa e escura vira anéis
 * concêntricos, e a única saída é dither: pixels vizinhos caem em
 * códigos diferentes e o olho faz a média.
 *
 * POR QUE OS DOIS DITHERS ANTERIORES NÃO FUNCIONARAM (os dois estavam
 * embutidos no alpha da textura): QUALQUER reamostragem destrói um
 * padrão de 1 pixel, porque o filtro bilinear tira a média das células
 * vizinhas. A textura 1x era AMPLIADA 2.625× (PNG de 616px desenhado a
 * 616dp num aparelho de PixelRatio 2.625); a `@3x` é REDUZIDA 0.875×.
 * Nenhuma das duas cai em 1.000. Não existe amplitude que resolva
 * isso — o problema é a escala, não o valor. Medido: mesmo com ±0.09
 * de amplitude (±4 níveis de saída), o histograma continuou com os
 * mesmos picos na escada.
 *
 * O QUE FUNCIONA: aplicar o ruído numa camada desenhada EXATAMENTE 1:1
 * com o pixel físico. O tamanho em dp é calculado em runtime a partir
 * do `PixelRatio`, então o ladrilho de 256px ocupa 256/PixelRatio dp =
 * 256px físicos, escala 1.000, sem filtro nenhum no caminho. Como não
 * dá pra confiar no `resizeMode="repeat"` (medido no aparelho: ele NÃO
 * replicou o ladrilho, esticou — desvio local 0.00 fora de um quadrado
 * de controle que deu 5.6), a repetição é feita à mão, numa grade.
 *
 * A amplitude: o ruído é cinza uniforme 0..255 e entra com opacidade
 * 0.02. Em luz linear isso dá um desvio de ~1.3 códigos — na medida do
 * degrau de quantização (1 código), que é o suficiente pra atravessá-lo
 * e ficar abaixo do que se percebe como granulado.
 *
 * Fica ACIMA das manchas e ABAIXO do conteúdo (é filho do mesmo
 * `AmbientGlow`, depois dos blobs), e `pointerEvents="none"`.
 */
const DITHER_TILE = require("../../assets/images/dither-tile.png");
const DITHER_TILE_PX = 256;

/*
 * VIÉS POR CANAL no ladrilho (2026-09-09, medido nos mapas do fundo):
 * o web mantém o vermelho entre 11 e 19 na área toda — é o que dá a ele
 * o ar CINZA-navy. No mobile o vermelho saía 0 em quase tudo, deixando
 * o fundo ciano. Motivo: a base `#0B0E14` tem R=11, e a escada do
 * aparelho na faixa escura não tem nenhum código entre 0 e 21 — o
 * vermelho é o canal mais esmagado dos três.
 *
 * MEDIDO com viés 1.70/1.10/0.85 (2026-09-09, 2ª rodada), média da
 * área escura: mobile `(7.1, 21.3, 26.2)` contra web `(11.1, 19.1,
 * 28.2)`. O vermelho subiu (era 0) mas ficou 4 curto, o verde passou
 * 2, e apareceu um efeito colateral: pra dar média 7 num canal cujo
 * aparelho não tem NENHUM código entre 0 e 21, o vermelho fica
 * alternando 0/20 pixel a pixel — 20 níveis de balanço. Onde a mancha
 * entra, ele trava em 20; a fronteira entre "alternando" e "travado"
 * lê como ANEL.
 *
 * Então o viés recuou pra 1.35/0.95/0.92: o verde e o azul passam a
 * bater com o web (previsto 18.4 e 28.4 contra 19.1 e 28.2) e o
 * vermelho fica em ~5.6 — ainda abaixo dos 11.1 do web, mas sem o
 * chiado de 20 níveis que estava desenhando o anel.
 *
 * LIMITE REAL, registrado pra não se tentar de novo por valor: na
 * faixa escura este aparelho tem 2 códigos de vermelho (0 e 21). R=11
 * não existe nele — só como mistura. Ou o fundo fica cinza e chia, ou
 * fica liso e um pouco mais frio que o web. Passar disso exige mudar
 * `colors.background` pra um tom que caia num código representável.
 */
/*
 * AMPLITUDE — medida contra o degrau real, não no olho (2026-09-09,
 * 3ª e definitiva rodada).
 *
 * Percorrendo uma linha que atravessa a mancha, o mobile ficava assim:
 * `28×22px  34×10px  39×4px  43×4px` — patamares largos parados nos
 * valores da escada. O web, na mesma linha: `28×4  29×5  31×4  32×5
 * 33×4  34×4  36×4` — todos os intermediários, degraus de 1.
 *
 * O degrau entre 28 e 34 é de SEIS níveis. O dither anterior tinha
 * desvio 1.06: só mistura pixels a ±1 do meio do degrau, então o resto
 * do patamar fica parado — que é exatamente o anel que se enxerga.
 * Regra: pra atravessar um degrau de N, a amplitude precisa chegar a
 * ±N/2.
 *
 * Duas mudanças, as duas pra render mais travessia com MENOS ruído
 * visível:
 *   - o ladrilho passou a ter distribuição UNIFORME (antes gaussiana).
 *     Uniforme cobre o degrau inteiro com metade do desvio de uma
 *     gaussiana equivalente — mesma capacidade de misturar, menos
 *     granulado.
 *   - a opacidade foi de 0.02 pra 0.05, e as médias do ladrilho caíram
 *     na mesma proporção (72/56/58 no lugar de 164/120/116), pra o TOM
 *     do fundo ficar onde já estava. Só a amplitude muda: ±3.6 no
 *     vermelho, ±2.8 no verde, ±2.9 no azul — na medida do degrau de 6.
 */
/*
 * 0.05 → 0.085 (2026-09-09, 4ª e última medição). O print mostrou que
 * a MÉDIA chega inteira (azul 27.7 contra 28.7 do web) mas a VARIAÇÃO
 * chega com 38% do projetado — a reamostragem da imagem preserva o
 * tom e come o desvio. Com ±4.0 projetados chegavam ±1.34, e sobravam
 * patamares de 3 a 5 níveis (`34×16px`, `25` pulando direto pra `20`).
 *
 * Como a perda é um fator fixo e conhecido, a compensação é aritmética:
 * pra entregar os ±2.5 que faltam, projeta-se 2.6× mais. Isso NÃO
 * clareia nada, porque o levante de tom é recalculado junto na base
 * compensada abaixo.
 */
/*
 * TESTE DIAGNÓSTICO (2026-09-16, a pedido — "o fundo e os cards
 * apresentam pontos, tipo noise/grain, o web é liso"). Achei a causa
 * antes de mexer: EXISTE, sim, uma textura de ruído intencional
 * aplicada global (`DitherLayer`, logo abaixo, renderizada dentro de
 * `AmbientGlow` — que é o fundo padrão de QUALQUER
 * `GlassTargetProvider`, ou seja, aparece atrás de praticamente toda
 * tela com vidro). Ela foi adicionada de propósito (ver o comentário
 * grande "DITHER — CAUSA RAIZ...", logo acima) pra resolver um problema
 * DIFERENTE e já medido: sem ela, as manchas de fundo (`AmbientGlow`)
 * mostravam ANÉIS CONCÊNTRICOS nítidos (banding) por causa da pouca
 * profundidade de cor do Android em tons escuros (~2 níveis de
 * vermelho, ~10 de verde, ~23 de azul na faixa escura) — o dither troca
 * essa banda dura por um granulado fino, que é exatamente o "noise" que
 * está sendo relatado agora.
 *
 * Ou seja: não é ausência de camada nenhuma nem artefato de
 * renderização "por acidente" — é uma troca deliberada (banding vs.
 * grão) que já foi validada assim antes. Só que ninguém tinha comparado
 * lado a lado com o web pra ver se o grão ficou mais visível do que a
 * banda que ele resolve.
 *
 * ISOLANDO A VARIÁVEL: `0.115 → 0`, SÓ ISSO, temporariamente — não mudo
 * blur nem escurecimento nenhum (`base`/`glow` continuam iguais).
 *   - Se o grão sumir e os anéis de banding NÃO voltarem visíveis no
 *     aparelho de teste → o dither pode ser reduzido/removido sem
 *     custo real, decisão fácil.
 *   - Se o grão sumir mas os anéis voltarem → é o trade-off documentado
 *     se manifestando; aí a decisão (grão fino vs. anel de banding) é seu.
 *   - Se o grão NÃO sumir (continuar igual com opacidade 0) → o dither
 *     não é a causa (ou não é a causa PRINCIPAL), e o problema está em
 *     outro lugar — meu próximo suspeito seria o próprio algoritmo de
 *     blur do Android (`dimezisBlurViewSdk31Plus`, já documentado como
 *     fonte de grão em fundos de blur — ver o histórico em `BlurView`,
 *     acima) e/ou escala do emulador (a captura enviada é de um
 *     "Android Emulator - Medium_Phone", não aparelho físico — GPU de
 *     emulador às vezes renderiza sem o mesmo anti-aliasing/dithering de
 *     saída de um aparelho real; se der pra repetir a mesma tela num
 *     device físico, ajuda a isolar isso).
 *
 * RESULTADO DO TESTE (confirmado por print) — os anéis de banding
 * VOLTARAM visíveis com `0`, faixas fortes no fundo. Isso prova que o
 * dither está fazendo trabalho real (o trade-off documentado é
 * verdadeiro, não teórico) — mas os CARDS continuaram granulados MESMO
 * com o dither desligado. Como `DitherLayer` nem chega a renderizar
 * dentro de um card (`dentroDeCard` retorna `null` — ver a função,
 * abaixo), o grão do card nunca poderia vir dele: a fonte é outra.
 * Valor restaurado, sem alternativa melhor encontrada ainda.
 */
/*
 * REABERTO (2026-09-16, a pedido — "agora no mobile tem umas ondas nas
 * manchas azuis, é possivel tirar e deixar lisa?", depois de subir a
 * opacidade das manchas do `HOME_GLOW_BLOBS` em ~74% no total — ×1.45
 * ("ilumina as manchas uns 45%") × ×1.20 ("aumenta a iluminação uns
 * 20%") — ver `lib/glowBlobs.ts`).
 *
 * CAUSA: essa amplitude foi calibrada, com medição real (todo o
 * histórico grande acima), pra ser EXATAMENTE meio degrau de
 * quantização (±3) contra a rampa de cor das manchas NO NÍVEL DE
 * OPACIDADE ORIGINAL. Subir a opacidade das manchas alarga a faixa de
 * cor que a rampa percorre — os degraus entre níveis de 8 bits ficam
 * maiores — e a mesma amplitude de ruído, que antes cobria exatamente
 * meio degrau, passa a cobrir MENOS que meio degrau relativo ao novo
 * degrau maior. É o mesmo mecanismo documentado no comentário grande
 * "AMPLITUDE — medida contra o degrau real", só que na direção
 * contrária (degrau cresceu, ruído não acompanhou).
 *
 * PRIMEIRA TENTATIVA (revertida) — escalei a mesma proporção do
 * aumento de opacidade das manchas (×1.45 × ×1.20 ≈ ×1.74): `0.115 →
 * 0.20 → 0.26`. ERRADO: a pedido — "percebi que não está mexendo
 * nessas ondas e sim escurecendo as manchas azuis" — e MEDINDO o
 * `dither-tile.png` de verdade (`Image.open(...).convert('RGB').mean()`)
 * a causa ficou clara: a média do ladrilho é `(70.5, 30.5, 26.0)` — um
 * tom ESCURO e AVERMELHADO, não cinza neutro (é a "base compensada",
 * ver o comentário abaixo — ele foi desenhado pra, numa opacidade
 * PEQUENA, corrigir quantização, não pra ser um véu visível). Subir a
 * opacidade dele de `0.115` pra `0.26` (mais que o dobro) faz esse tom
 * escuro/vermelho dominar cada vez mais a mistura por cima do azul das
 * manchas — é isso que lê como "escurecendo", não como liso. Nunca
 * chega a resolver as ondas porque essa amplitude NÃO é a alavanca
 * certa pra um degrau de quantização maior — ela move o TOM médio, não
 * o tamanho do degrau. Revertido pro valor original, já validado.
 */
const DITHER_OPACITY = 0.115;

/**
 * BASE COMPENSADA — o ruído só CLAREIA (compõe na direção da cor dele),
 * então subir a amplitude subiria também o tom do fundo. Com as médias
 * 120/96/120 e opacidade 0.115. Ela é ESCURA de propósito: amplitude e
 * tom andavam juntos (os dois valem `q × média`), e o único jeito de
 * soltar um do outro é abaixar a base — o ruído devolve o tom, e a
 * amplitude fica livre pra crescer. Com base (5.3, 3.4, 7.0) o
 * composto volta a (11.0, 14.1, 20.0), que é o `#0B0E14` do web.
 *
 * CORREÇÃO (medição seguinte): eu tinha suposto que o vermelho chegava
 * com 43% da amplitude, contra ~100% dos outros dois. Errado — ele
 * entrega igual. Com a suposição errada o fundo saiu AVERMELHADO:
 * medido `(19.3, 17.9, 27.5)` contra `(11.1, 18.7, 27.5)` do web, ou
 * seja G e B exatos e R oito níveis acima.
 *
 * Corrigido só no canal vermelho: média do ladrilho 120 → 96 e base
 * R → 0.
 *
 * A REGRA QUE FECHOU (a pedido — "era pra apenas deixar liso sem
 * ruídos", depois de baixar a amplitude no geral e o anel voltar):
 * a amplitude tem que ser EXATAMENTE MEIO DEGRAU, ±3.
 *
 * Por quê: nas áreas LISAS o fundo já cai em cima de um valor da
 * escada (20 no verde, 28 no azul). Ruído maior que meio degrau chuta
 * os pixels pros vizinhos (0, 28, 34) e cria chiado onde não havia
 * banda nenhuma pra corrigir — era isso, e não "ruído demais em geral".
 * Ruído menor que meio degrau não atravessa o degrau de 6 nas RAMPAS,
 * e o anel volta. ±3 é o único ponto que resolve os dois.
 *
 * A base agora é escolhida pra que o liso caia EM CIMA da escada:
 * `#00131C` dá (1, 20, 28) contra (11, 19, 28) do web — verde e azul
 * exatos. O vermelho fica em 1 porque nesta faixa o aparelho só tem 0
 * e 20: pra dar 11 ele teria que alternar entre os dois, que é
 * justamente o chiado. Fica no 0, liso.
 *
 * (Histórico do passo anterior:
 * com os patamares já fechados (medido: maior salto entre patamares
 * largos = 1, igual ao web, nas três linhas), sobrou folga pra baixar
 * a amplitude. Ela caiu pra 65% (médias 62/62/78) e a base subiu na
 * mesma conta, então o TOM não muda — e ainda entrou o ajuste dos 1 a
 * 3 níveis que faltavam pro web (medido `8.0/17.2/26.9` contra
 * `11.1/19.0/27.9`). O ruído também ficou mais fino (passa-alta de
 * sigma 1.1 → 0.8): mesma capacidade de misturar, frequência mais
 * alta, que é onde o olho menos enxerga.)
 * Esta base é `colors.background` (#0B0E14) MENOS esse levante, de modo
 * que base + ruído dê de volta o preto do web. É o que permite ter
 * amplitude alta sem clarear nada.
 */
const DITHER_COMPENSATED_BASE = "#08131C";

function DitherLayer() {
  const dentroDeCard = useContext(InsideGlassContext);
  const { width, height } = useWindowDimensions();
  if (dentroDeCard) return null;
  const dpr = PixelRatio.get();
  const lado = DITHER_TILE_PX / dpr; // dp que dá exatamente 256px físicos
  /*
   * ALINHAMENTO AO PIXEL FÍSICO (2026-09-09) — medido: a amplitude que
   * chegava na tela era 55% da projetada (desvio 0.92 contra 1.67).
   * Causa: cada ladrilho era posto em `coluna × 97.5238dp`, que em
   * pixel físico cai em FRAÇÃO — e o Android interpola, fazendo a
   * média dos pixels vizinhos do ruído e comendo metade da amplitude.
   * `emPixelInteiro` arredonda a posição pro pixel físico mais próximo
   * antes de converter de volta pra dp, então cada ladrilho começa
   * exatamente em cima de um pixel e nada é interpolado.
   */
  const emPixelInteiro = (dp: number) => Math.round(dp * dpr) / dpr;
  const colunas = Math.ceil(width / lado);
  const linhas = Math.ceil(height / lado);
  const celulas: React.ReactElement[] = [];
  for (let l = 0; l < linhas; l++) {
    for (let c = 0; c < colunas; c++) {
      celulas.push(
        <Image
          key={`${l}-${c}`}
          source={DITHER_TILE}
          style={{
            position: "absolute",
            left: emPixelInteiro(c * lado),
            top: emPixelInteiro(l * lado),
            width: lado,
            height: lado,
            opacity: DITHER_OPACITY,
          }}
        />
      );
    }
  }
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {celulas}
    </View>
  );
}

export function AmbientGlow({ blobs = BLOBS }: { blobs?: GlowBlob[] }) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {blobs.map((blob, index) => {
        const { tint, opacity } = parseGlowColor(blob.color);
        const { top, bottom, left, right, size } = growGlowBlob(blob);
        return (
          <Image
            key={index}
            // A imagem do DIÂMETRO desta mancha — ver `GLOW_DISCS`. Cor
            // e opacidade entram literais do web, sem fator nenhum.
            source={GLOW_DISCS[blob.size]}
            resizeMode="cover"
            style={{
              position: "absolute",
              top,
              bottom,
              left,
              right,
              width: size,
              height: size,
              tintColor: tint,
              opacity,
            }}
          />
        );
      })}
      <DitherLayer />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * CORREÇÃO (2026-09-03, a pedido — "analise a fundo o efeito de
   * vidro que tem no web, e implementa", depois do resto do "vidro"
   * já corrigido nesta sessão) — causa raiz: o card `Glass` nunca teve
   * NENHUMA sombra. O "vidro iluminado" do web (`StatisticsCard.tsx`,
   * `ProfileHeader.tsx`) não é só blur + gradiente — tem um
   * `box-shadow` de 3 camadas em CIMA do blur: uma sombra de queda
   * pra fora (`0 10px 30px rgba(0,0,0,0.35)`, dá profundidade, separa
   * o card do fundo) + duas sombras INTERNAS finas de 1px (`inset 0 1px
   * 0 rgba(255,255,255,0.16)` no topo — o "brilho pegando luz" na
   * borda de cima — e `inset 0 -1px 0 rgba(0,0,0,0.15)` embaixo — a
   * "sombra" natural na borda de baixo). Sem essas duas linhas
   * internas, QUALQUER caixa translúcida lisa lê como "só cinza
   * transparente", nunca como vidro de verdade — é o principal motivo
   * do "não tem efeito vidro" reportado.
   *
   * RN só ganhou suporte a `boxShadow` (incluindo `inset`) com a New
   * Architecture (que este app já usa — é o que permite o
   * `BlurTargetView`/`blurTarget` do próprio `expo-blur` funcionar,
   * ver comentário no topo do arquivo) — por isso nunca dava pra ter
   * isso antes do upgrade pro SDK 55. Mesmos valores exatos do web
   * (`StatisticsCard.tsx`), só reescritos no formato de objeto que o
   * RN pede em vez de string CSS.
   *
   * NÃO RESOLVIDO NESTA RODADA (limitação real da biblioteca, não
   * decisão minha) — o web também aplica `backdrop-saturate-180%`
   * (deixa o que está sendo borrado atrás mais vívido/colorido). O
   * `BlurView` do `expo-blur` não tem NENHUM controle de saturação
   * (conferido na documentação oficial) — não existe prop equivalente
   * pra portar. Fica como diferença conhecida, não uma tentativa
   * malsucedida escondida.
   */
  /**
   * CALIBRAÇÃO (2026-09-04) — a moldura era uma `View` de 1px encostada
   * POR DENTRO da borda. Funcionou como conceito, mas criava DOIS anéis
   * concêntricos com raios diferentes, e a borda do card virava uma
   * rampa difusa. Medido, atravessando a borda de cima (soma dos canais):
   *
   *     web     58 → 195 → 231 → 128     (sobe em 2px, limpo)
   *     mobile  59 → 83 → 110 → 175 → 164 → 118   (rampa de 4px)
   *
   * O web tem UM anel só. Então a moldura deixou de ser camada separada
   * e virou COR POR LADO da mesma borda de 1px: um anel único, que
   * acompanha o raio perfeitamente (é uma borda de verdade, não um
   * retângulo desenhado por cima) e continua tendo topo claro e base
   * escura — a espessura de vidro que a `View` dava, sem a borda dupla.
   *
   * Os valores são a soma do que o web empilha em cada lado:
   *  - topo:     borda `white/0.10` + `inset 0 1px 0 white/0.16`
   *  - laterais: só a borda, `white/0.10` (literal do web)
   *  - base:     borda `white/0.10` escurecida pelo `inset 0 -1px 0 black/0.15`
   *
   * Isso também repõe a definição das laterais, que tinha caído demais
   * quando a borda externa foi pra 0.06 (degrau medido de 54 contra 152
   * do web) — agora elas voltam ao 0.10 do web.
   */

  /** Anula o `backgroundColor` que o `expo-blur` calcula sozinho — ver o comentário no `BlurView`, acima. */
  noBlurVeil: {
    backgroundColor: "transparent",
  },
  /** A `View` de fora só RESERVA o espaço da borda; quem pinta é a camada de cima. */
  bordaTransparente: {
    borderColor: "transparent",
  },
  wrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: glass.borderNeutral,
    /**
     * RESULTADO DO TESTE DE DIAGNÓSTICO (2026-09-03, confirmado com
     * print real — Android 12) — magenta (sombra externa) apareceu
     * perfeitamente; ciano (sombra interna, 20px) não apareceu em
     * lugar nenhum. Causa raiz: ver comentário completo em `Glass()`,
     * acima, onde `styles.insetShine` explica o porquê e o fix. Só a
     * sombra EXTERNA fica aqui, no `boxShadow` do `BlurView` (ela não
     * tem esse problema, é a mesma que já funcionou no teste); as 2
     * internas se mudaram pra `insetShine`.
     */
    boxShadow: [{ offsetX: 0, offsetY: 10, blurRadius: 30, color: "rgba(0,0,0,0.35)" }],
  },
  /**
   * As 2 sombras INTERNAS do "vidro iluminado" (brilho fino no topo +
   * sombra fina embaixo) — ficavam invisíveis quando estavam no
   * `boxShadow` do `BlurView` (`styles.wrap`, acima) porque o blur
   * nativo cobre por cima da própria sombra do elemento que o
   * desenha. Aqui como `View` FILHA do `BlurView` (ver `Glass()`),
   * desenha por CIMA do blur, igual ao `gradientNeutral`. Mesmos
   * valores exatos do web (`StatisticsCard.tsx`/`ProfileHeader.tsx`).
   */
  /**
   * NÃO ESTÁ SENDO RENDERIZADO desde 2026-09-04 — ver o comentário do
   * teste no JSX do `Glass`. Mantido aqui de propósito: se o vidro ficar
   * chapado demais sem reflexo nenhum, voltar é uma linha só. Se o teste
   * confirmar que a borda sozinha basta, este bloco pode sair de vez.
   */
  insetShineTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    /**
     * CAUSA RAIZ FINAL, CONFIRMADA COM TESTE (2026-09-03, 4ª rodada) —
     * o teste de diagnóstico anterior (linha ROSA de 8px/100% opaco em
     * cima, CIANO de 8px/100% embaixo — mesmo espírito do teste
     * magenta/ciano que achou o problema do `boxShadow`) apareceu
     * PERFEITAMENTE no aparelho (print real confirmado). Isso fecha a
     * investigação: a técnica funciona, a entrega pro celular funciona,
     * o cache/restart funciona — NUNCA foi bug de renderização. O
     * valor original (`rgba(255,255,255,0.16)`, 1px — cópia exata do
     * `box-shadow` do web) ESTAVA desenhando o tempo todo; só é sutil
     * demais pra perceber na tela pequena do celular (e em prints/fotos
     * comprimidos) mesmo sendo idêntico ao CSS do web (que só "funciona
     * visualmente" lá por causa do monitor maior + navegador sem
     * recompressão). Escolhida a opção "sutil realista" (a pedido,
     * dentre as alternativas apresentadas): opacidade aumentada de 16%
     * pra 35%.
     *
     * REVERTIDO (2026-09-04, print real — "linha branca evidente no topo
     * de todo componente Glass"). Aquele reforço fazia sentido no vidro
     * ANTIGO, que era claro e lavado: ali o reflexo de 16% sumia. Depois
     * da calibração do material (véu azul, ver `glassVariants` em
     * `lib/theme.ts`) o card ficou escuro como o do web — e o mesmo 35%
     * passou a ler como uma LINHA DESENHADA por cima, não como reflexo.
     *
     * A estrutura nunca esteve errada: o web também tem borda E reflexo
     * de topo. Errado era o VALOR, e de um jeito específico — 0.35 é o
     * número que o web usa nos BOTÕES GEL (15 ocorrências), não nos
     * cards de vidro (2 ocorrências: 0.16 e 0.18). No próprio
     * `StatisticsCard.tsx` do web os dois convivem: 0.16 no card, 0.35
     * na pílula âmbar. O mobile tinha pegado o da pílula.
     *
     * Agora é o valor real do card. A borda geral (`white/0.10`)
     * continua intocada — o problema nunca foi ela, e enfraquecê-la
     * apagaria os outros três lados sem necessidade.
     */
    height: 1,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  insetShineBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    /**
     * Mesma reversão do `insetShineTop`, acima: tinha sido levantada de
     * 15% pra 30% pelo mesmo motivo (vidro claro antigo) e volta agora
     * ao valor real do web (`inset 0 -1px 0 rgba(0,0,0,0.15)`).
     */
    height: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  /**
   * CORREÇÃO (2026-09-03, a pedido — "o botão 'ver detalhes' ainda não
   * está igual ao web", root-caused comparando com o CSS de verdade
   * do web: `StatisticsCard.tsx` e `ProfileHeader.tsx`, os dois usos
   * de pílula "gel" lá) — o `GelSurface` daqui nunca teve borda nem
   * sombra nenhuma, só o preenchimento em degradê + o reflexo de topo
   * (`gel.highlight`). O web usa, nos DOIS lugares (mesmos valores
   * exatos nos dois — "Ver detalhes" e "Editar"), `border-white/15`
   * (borda de 1px branca bem sutil) + um `box-shadow` de 2 camadas
   * internas: `inset 0 1px 0 rgba(255,255,255,0.35)` (brilho fino no
   * topo — o `gel.highlight` já aproximava isso, mas com gradiente em
   * vez de sombra de verdade) e `inset 0 -4px 7px rgba(120,66,10,0.4)`
   * (sombra marrom-escura grossa embaixo — dá o relevo "gel", NUNCA
   * existiu no mobile). Mesma técnica de `boxShadow`+`inset` que já
   * funcionou no `Glass` (`styles.wrap`, acima) — precisa da New
   * Architecture, que este app já usa.
   */
  /**
   * CONTORNO (2026-09-09, medido no print, duas tentativas antes desta).
   *
   * No web a linha do perímetro é CREME — `rgb(213,162,94)` em cima e
   * `rgb(221,180,129)` no ponto onde ela soma com o brilho interno de
   * 1px. No mobile saía CINZA, `rgb(41,44,46)`.
   *
   * Causa: o web usa `background-clip: border-box`, ou seja o degradê
   * âmbar é pintado TAMBÉM debaixo da borda, e o `border-white/15`
   * compõe branco sobre âmbar. No RN o filho absoluto é recortado pelo
   * `overflow: "hidden"` na borda INTERNA — tentei esticar o degradê
   * 1px pra fora e ele simplesmente foi cortado (foi a tentativa
   * anterior, que não mudou nada na tela).
   *
   * Fix: em vez de pintar por baixo, a borda já entra com a cor
   * COMPOSTA. `rgba(255,255,255,0.15)` sobre o degradê dá, em cada
   * ponto: topo `205,145,65` → `213,162,94`; base `176,95,27` →
   * `217,119,61`; laterais, a média → `208,153,85`. Os três valores
   * saem da conta, não do olho, e o RN aceita cor por lado.
   */
  gelWrap: {
    /*
     * Valores AJUSTADOS ao que o print mostrou (2026-09-09, 2ª rodada —
     * "a cor está laranja e no web é mais puxado pra amarelo"). Medido:
     * o topo do web sai `rgb(221,180,129)` e o mobile saía
     * `rgb(204,162,109)`; a lateral do web sai `rgb(209,164,102)` e a
     * do mobile `rgb(206,151,83)`. Mesma matiz, o mobile é ~17 níveis
     * mais escuro — e no escuro essa matiz lê como laranja, no claro
     * como amarelo/creme. Os valores abaixo são os do mobile mais o
     * delta medido até o web.
     */
    /* Os valores mudaram de casa (2026-09-09): agora moram em `gel.border`, em `lib/theme.ts`, porque a cápsula das abas usa os MESMOS — e duas cópias divergiriam na primeira recalibração. */
    borderTopColor: gel.border.top,
    borderBottomColor: gel.border.bottom,
    borderLeftColor: gel.border.left,
    borderRightColor: gel.border.right,
    overflow: "hidden",
    /**
     * CORREÇÃO (2026-09-04, a pedido — "no web o botão tem uma borda,
     * adiciona no mobile").
     *
     * A borda existia, mas como `View` sobreposta (`absoluteFillObject`
     * + `borderWidth: 1`) DENTRO deste container, que tem
     * `overflow: "hidden"` e raio 999. Ela traçava exatamente a linha de
     * corte do recorte, e o antialiasing da máscara comia quase todo o
     * 1px — no aparelho não aparecia nada.
     *
     * A borda NATIVA da view não passa por isso: o RN a desenha por cima
     * do próprio background (aqui, o degradê do `LinearGradient`), que é
     * o mesmo empilhamento do CSS, onde `background` pinta a border-box e
     * a borda vem em cima. Valor literal do web: `border-white/15`.
     */
    borderWidth: 1,
  },
  /**
   * A borda do web (`border border-white/15`), agora desenhada DEPOIS do
   * gradiente, para compor sobre o dourado como no CSS. Mesmo valor de
   * sempre — nenhuma cor âmbar foi inventada aqui.
   */
  /**
   * Ver comentário em `GelSurface()`, acima — mesma técnica do
   * `insetShineTop`/`insetShineBottom` do `Glass`.
   */
  gelInsetShineTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  /**
   * CORREÇÃO (2026-09-04) — era 8. O web usa `inset 0 -4px 7px`: a
   * sombra desce 4px e ainda espalha 7px de desfoque, ou seja alcança
   * ~11px a partir da base. Com 8 ela morria cedo e a base do botão não
   * escurecia — medido: base do mobile #CD8A3A contra #B67C31 do web.
   */
  gelInsetShineBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 11,
  },
});
