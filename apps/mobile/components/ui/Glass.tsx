import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import { View, Image, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { BlurView, BlurTargetView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { glass, gel } from "@/lib/theme";

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
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** O que fica atrás do conteúdo e é o que o blur efetivamente mostra. Padrão: `AmbientGlow`. Passe `null` pra tela sem manchas de cor. */
  background?: ReactNode;
}) {
  const targetRef = useRef<View>(null);
  return (
    <View style={style}>
      <BlurTargetView ref={targetRef} style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {background}
      </BlurTargetView>
      <GlassTargetContext.Provider value={targetRef}>{children}</GlassTargetContext.Provider>
    </View>
  );
}

export interface GlassProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * Card em "vidro" — usar no lugar de um `View` com `colors.surface` +
 * `colors.border` sempre que o card estiver dentro de um
 * `GlassTargetProvider` (telas ainda não convertidas continuam com o
 * visual antigo até a vez delas, por escolha — "tela a tela").
 */
export function Glass({ style, children, ...props }: GlassProps) {
  const target = useContext(GlassTargetContext);
  return (
    <BlurView
      blurTarget={target ?? undefined}
      intensity={glass.blurIntensity}
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
      blurMethod="dimezisBlurView"
      style={[styles.wrap, style]}
      {...props}
    >
      <LinearGradient
        colors={glass.gradientNeutral}
        start={{ x: 0.14, y: 0.15 }}
        end={{ x: 0.9, y: 0.85 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
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
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <View style={styles.insetShineTop} />
        <View style={styles.insetShineBottom} />
      </View>
      {children}
    </BlurView>
  );
}

export interface GelSurfaceProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * "Gel" âmbar — OPACO, sem blur, pra CTA/pílula em destaque (não é
 * vidro: não precisa estar dentro de um `GlassTargetProvider`, funciona
 * em qualquer tela).
 */
export function GelSurface({ style, children, ...props }: GelSurfaceProps) {
  return (
    <LinearGradient colors={gel.gradient} start={{ x: 0.28, y: 0.18 }} end={{ x: 0.85, y: 0.95 }} style={[styles.gelWrap, style]} {...props}>
      <LinearGradient
        colors={gel.highlight}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
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
    </LinearGradient>
  );
}

export type GlowBlob = { color: string; top?: number; bottom?: number; left?: number; right?: number; size: number };

const BLOBS: GlowBlob[] = [
  { color: "rgba(232,163,61,0.5)", top: -60, left: -80, size: 260 },
  { color: "rgba(79,209,197,0.4)", top: 220, right: -100, size: 300 },
  { color: "rgba(232,163,61,0.32)", bottom: -40, left: -60, size: 240 },
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
const GLOW_BRIGHTNESS_BOOST = 1.68;

function parseGlowColor(rgba: string): { tint: string; opacity: number } {
  const match = rgba.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!match) return { tint: rgba, opacity: 1 };
  const [, r, g, b, a] = match;
  const baseOpacity = a !== undefined ? parseFloat(a) : 1;
  return { tint: `rgb(${r}, ${g}, ${b})`, opacity: Math.min(1, baseOpacity * GLOW_BRIGHTNESS_BOOST) };
}

const GLOW_IMAGE = require("../../assets/images/glow-soft.png");

/**
 * CAUSA RAIZ DO TAMANHO (2026-09-03, achada depois de duas rodadas de
 * ajuste por tentativa — "+40%", depois "+70%" — que o usuário
 * corretamente apontou que ainda não batiam com o web, e perguntou
 * "qual o tamanho das manchas no web?") — conferido direto no código-
 * fonte, `apps/web/components/profile/ProfileView.tsx`: cada mancha lá
 * é uma `<div>` com um tamanho de CAIXA (`h-64 w-64` = 256px, `h-60
 * w-60` = 240px, etc. — exatamente os mesmos números já usados em
 * `blob.size`/`PROFILE_GLOW_BLOBS` aqui, ou seja o tamanho da CAIXA
 * sempre esteve certo) MAIS a classe `blur-[60px]` (`filter:
 * blur(60px)` puro do CSS) aplicada por cima. Um desfoque gaussiano de
 * 60px não é cosmético só na borda — ele espalha visivelmente a mancha
 * pra muito além da caixa original (o próprio comentário do web, mais
 * acima neste arquivo, descreve isso: "o desfoque vaza naturalmente
 * pro espaço vazio ao redor da coluna"). Os ajustes em % anteriores
 * (`GLOW_SIZE_BOOST`) estavam tentando compensar esse espalhamento no
 * escuro, sem usar o número real do web — por isso não convergiam.
 *
 * FIX (troca a % chutada por uma conta baseada no valor real do web):
 * um blur gaussiano de raio R fica visualmente imperceptível a partir
 * de ~3 desvios-padrão do centro (é o "alcance" que a própria spec do
 * `filter: blur()` usa como equivalência — `stdDeviation = R`). Então
 * o espalhamento visível total, pra CADA lado da caixa original, é
 * `3 × 60px = 180px` — somado (não multiplicado, já que é o mesmo blur
 * de 60px pras 8 manchas, do maior ao menor) ao tamanho da caixa
 * original de cada mancha. `growGlowBlob` faz essa soma e recalcula
 * top/bottom/left/right pra manter o CENTRO da mancha no mesmo lugar
 * de antes, só aumentando o raio visível.
 */
const WEB_BLUR_RADIUS_PX = 60; // `blur-[60px]` em `ProfileView.tsx` (e nas outras telas que usam `AmbientGlow`)
const BLUR_VISIBLE_SPREAD_PX = WEB_BLUR_RADIUS_PX * 3; // raio a partir do qual um blur gaussiano de 60px já é imperceptível

function growGlowBlob(blob: GlowBlob): { top?: number; bottom?: number; left?: number; right?: number; size: number } {
  const size = blob.size + BLUR_VISIBLE_SPREAD_PX * 2;
  const halfDelta = BLUR_VISIBLE_SPREAD_PX;
  return {
    top: blob.top !== undefined ? blob.top - halfDelta : undefined,
    bottom: blob.bottom !== undefined ? blob.bottom - halfDelta : undefined,
    left: blob.left !== undefined ? blob.left - halfDelta : undefined,
    right: blob.right !== undefined ? blob.right - halfDelta : undefined,
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
export function AmbientGlow({ blobs = BLOBS }: { blobs?: GlowBlob[] }) {
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {blobs.map((blob, index) => {
        const { tint, opacity } = parseGlowColor(blob.color);
        const { top, bottom, left, right, size } = growGlowBlob(blob);
        return (
          <Image
            key={index}
            source={GLOW_IMAGE}
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
     * pra 35%, mantendo 1px — mais perceptível sem virar um efeito
     * chapado/artificial.
     */
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  insetShineBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    /**
     * Mesma correção do `insetShineTop`, acima — opacidade aumentada de
     * 15% pra 30% (escolha "sutil realista"), 1px mantido.
     */
    height: 1,
    backgroundColor: "rgba(0,0,0,0.30)",
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
  gelWrap: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
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
  gelInsetShineBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 8,
  },
});
