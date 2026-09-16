/**
 * TASK-090 (fundação nativa) — tokens de cor pro app mobile.
 *
 * O web resolve cores em tempo real via CSS var (ver
 * `packages/config/src/tailwind-tokens.ts` + `globals.css`), pra
 * suportar tema claro/escuro trocável sem rebuild. React Native não
 * tem CSS var — os valores aqui são os hex FIXOS do tema escuro
 * (`:root, .dark` em globals.css), que é o único tema que o app
 * mobile usa por enquanto (`"userInterfaceStyle": "dark"` em
 * app.json). Se um dia o mobile ganhar tema claro, este arquivo vira
 * um objeto com as duas paletas + um hook de tema — não antes disso.
 *
 * Fonte única de verdade pros valores: apps/web/app/globals.css.
 */
export const colors = {
  background: "#0B0E14",
  surface: "#131826",
  primary: "#E8A33D",
  secondary: "#4FD1C5",
  text: "#F4F1E8",
  muted: "#8C93A8",
  border: "#262D40",
  success: "#34C77B",
  warning: "#F0B429",
  danger: "#E8574A",
} as const;

export type ColorToken = keyof typeof colors;

/** Escala de espaçamento simples — múltiplos de 4, igual ao ritmo do Tailwind do web (space-4 = 16px etc.). */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 999,
} as const;

/**
 * CORREÇÃO (a pedido — auditoria visual, "profundidade/sombra") —
 * achado real: de todo o app, só 4 arquivos usavam sombra, cada um
 * com valor diferente "no olho" (sem escala) — os mais de 10
 * componentes de card do app (pôster, review, post, comentário)
 * eram completamente planos, só cor+borda. Escala de elevação nova,
 * 3 níveis (baixo → alto), pra usar em vez de inventar valor solto
 * de novo — mesma disciplina do `spacing`/`radius`/`fontSize`.
 * Espelhada no web (`app/globals.css`, classes `.shadow-card-*`)
 * pras duas plataformas ficarem com a mesma sensação de profundidade.
 */
/**
 * CORREÇÃO (a pedido — auditoria de consistência) — achado real: a
 * cor da marca aparecia escrita à mão (`rgba(232,163,61,...)`) em
 * 14 lugares, com NOVE opacidades diferentes (0.05, 0.06, 0.1,
 * 0.12, 0.15, 0.16, 0.25, 0.4, 0.6) — quase sempre pra mesma coisa:
 * "fundo sutil de item selecionado/destacado". Isso é invisível item
 * a item, mas somado é o que faz um app parecer montado por pessoas
 * diferentes. Três tons oficiais agora, pra usar em vez de inventar
 * uma opacidade nova a cada tela.
 */
/**
 * CORREÇÃO (a pedido — auditoria de consistência) — achado real:
 * "véu escuro" (fundo de modal, camada sobre imagem, fundo de botão
 * flutuante sobre pôster) aparecia 28 vezes escrito à mão, com DEZ
 * valores diferentes — e misturando duas cores base (`#000` puro em
 * uns lugares, a cor de fundo do app `#0B0E14` em outros), o que dá
 * temperaturas visivelmente diferentes lado a lado. Três papéis
 * definidos agora:
 */
/**
 * CORREÇÃO (a pedido — auditoria de consistência, "duração de
 * animações diferente") — o app tinha só 3 componentes animados, e
 * cada um escolheu a própria duração no olho (300, 700, 1800). Sem
 * escala, cada animação nova inventava um número — e duração
 * inconsistente é das coisas que mais fazem uma interface parecer
 * "montada por pessoas diferentes", mesmo que ninguém saiba apontar
 * o porquê.
 */
export const motion = {
  /** Reação imediata ao toque (escala de botão) — precisa ser quase imperceptível. */
  fast: 120,
  /** Transição padrão: entrada de item, aparecer/sumir. */
  normal: 240,
  /** Movimento com mais presença — celebração, destaque. */
  slow: 400,
} as const;

export const scrim = {
  /** Fundo de modal/bottom sheet — escurece a tela inteira atrás. */
  modal: "rgba(0,0,0,0.6)",
  /** Camada sobre imagem, pra texto ficar legível por cima (capa, backdrop). */
  overImage: "rgba(11,14,20,0.7)",
  /** Fundo de controle flutuante sobre imagem (botão de voltar, "+" no pôster). */
  control: "rgba(11,14,20,0.75)",
} as const;

export const tint = {
  /** Fundo sutil de item selecionado/ativo (linha de lista, chip, opção escolhida). */
  subtle: "rgba(232,163,61,0.12)",
  /** Preenchimento com mais presença — barra de resultado de enquete, destaque forte. */
  strong: "rgba(232,163,61,0.25)",
  /** Borda de item destacado (nunca fundo). */
  border: "rgba(232,163,61,0.4)",
} as const;

export const elevation = {
  low: {
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  medium: {
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  high: {
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
} as const;

/**
 * CORREÇÃO (a pedido — auditoria de consistência) — achado real: a
 * escala começava em 12, mas o app usa MUITO texto menor que isso
 * (rótulo embaixo de ícone, contador, legenda) — 71 usos de 9/10/11
 * escritos à mão, sem token nenhum, então cada tela inventava o
 * próprio "pequeno". Dois degraus novos abaixo do `xs` fecham essa
 * lacuna:
 * - `xxs` (11): legenda, contador, data — o "pequeno" mais comum.
 * - `micro` (10): rótulo curto embaixo de ícone, selo em caixa alta.
 * Abaixo de 10 não deve existir (fica ilegível pra muita gente e
 * some em tela com brilho alto).
 */
export const fontSize = {
  micro: 10,
  xxs: 11,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/**
 * Porte do redesign "âmbar/vidro" do web pro mobile (ver comentário
 * "Vidro"/"gel" em qualquer arquivo `apps/web/components` que usa
 * `backdrop-blur` + `radial-gradient` translúcido) — precisou esperar
 * o upgrade pro Expo SDK 55 (RN 0.83): antes disso, o `expo-blur` só
 * desfoca de verdade no iOS — no Android cai pra uma caixa
 * semi-transparente lisa, sem desfoque nenhum, o que deixaria as duas
 * plataformas com visual DIFERENTE (pedido explícito do usuário:
 * "preciso que o app web e o mobile tenham o mesmo design"). Com o
 * SDK 55 e a API nova (`BlurTargetView`, ver `components/ui/Glass.tsx`),
 * o blur é real e igual nas duas.
 *
 * React Native não tem `radial-gradient()` — os gradientes aqui usam
 * `LinearGradient` na diagonal (canto superior-esquerdo mais claro,
 * apagando pro canto oposto) como aproximação do "brilho concentrado"
 * do radial do web. Mesma ideia, sem a curvatura exata.
 */
/**
 * AUDITORIA DO SISTEMA DE VIDRO (2026-09-04, a pedido — "identifique o
 * sistema de glass que já existe no web e reutilize os mesmos valores,
 * não crie um novo").
 *
 * O web NÃO tem classe nem token central de vidro: `globals.css` só
 * define as cores. O que existe é um sistema DE FATO — as mesmas
 * receitas repetidas literalmente dezenas de vezes nos componentes.
 * Levantadas por contagem em `apps/web/components` (frequência real):
 *
 *  27×  0.13 / 0.06  `radial-gradient(75% 100% at 14% 15%, …, transparent 60%)`  blur 10px  → chip, linha
 *  23×  0.17 / 0.10  idem                                                        blur 18px  → cartão
 *  23×  0.16 / 0.09  `radial-gradient(70% 80% at 20% 15%, …, transparent 60%)`   blur 14px  → intermediário
 *  15×  0.26 / 0.10  `radial-gradient(70% 75% at 25% 20%, …, transparent 65%)`   blur 10px  → botão-círculo sobre imagem
 *   8×  0.17 / rgba(20,22,30,0.85)                                               blur 18px  → painel escuro (dropdown/sheet)
 *
 * São essas cinco abaixo, com os números do web, sem arredondar.
 *
 * DUAS DIFERENÇAS ESTRUTURAIS que o mobile tinha e o web não (as duas
 * corrigidas junto com este token — ver `components/ui/Glass.tsx`):
 *
 * 1. O mobile usava UMA receita só — a mais leve (0.13/0.06, que no
 *    web é de chip) — em TUDO, inclusive em cartão, que no web é
 *    0.17/0.10. Todo cartão do app estava mais apagado que o do web.
 * 2. O mobile desenhava um `LinearGradient` atravessando a superfície
 *    inteira; o web é BASE CHAPADA + brilho radial de CANTO que morre
 *    aos 60%. Estruturas diferentes: o web tem corpo uniforme com um
 *    glint no canto, o mobile tinha lavagem de ponta a ponta.
 *
 * CALIBRAÇÃO APROVADA (2026-09-04, validada no aparelho pelo usuário
 * usando o card de Estatísticas como corpo de prova) — o `base` de cada
 * receita NÃO é mais o branco literal do web. Motivo medido, não
 * estético: o `BlurView` do Android soma um véu claro próprio que o CSS
 * não tem, então o mesmo branco chega ~7% mais claro aqui e lava o card
 * pra cinza. Resolvendo a composição contra os pixels do web em duas
 * zonas (uma sem glow, outra com), a cor de véu que reproduz o
 * resultado dele é `rgb(80,115,180)` — azul, não branca.
 *
 * O ALFA de cada receita continua sendo o do web (0.06 / 0.10 / 0.09 /
 * 0.10): a transparência não mudou, o glow segue passando. Só a COR do
 * véu mudou. Na prática é o `backdrop-saturate-[180%]` reaparecendo —
 * no web ele satura o azul do fundo no composite; como o `expo-blur`
 * não sabe saturar, o mesmo efeito vem de tingir o véu de azul.
 *
 * A receita `dark` (painel de dropdown) não muda: ela já é escura.
 *
 * `blurIntensity` é o único valor que não dá pra copiar: o web mede em
 * px de `backdrop-filter`, o `expo-blur` usa escala própria 0-100 sem
 * equivalência documentada. Mantida a proporção já calibrada no
 * aparelho (18px ↔ 45) e estendida por regra de três — aproximação
 * assumida, não medida.
 */
export type GlassVariantName = "light" | "card" | "medium" | "icon" | "dark" | "dock" | "pill" | "subtle" | "bannerIcon";

export interface GlassVariant {
  /** Cor de base chapada (no web, o valor depois da vírgula no `background`). */
  base: string;
  /** Cor no centro do brilho radial de canto. */
  highlight: string;
  /** Geometria do `radial-gradient` do web: raios (% da largura/altura) e centro (%). */
  highlightRadiusX: number;
  highlightRadiusY: number;
  highlightCenterX: number;
  highlightCenterY: number;
  /** Parada `transparent N%` — onde o brilho já sumiu de vez. */
  highlightStop: number;
  /** Escala 0-100 do `expo-blur` (ver nota sobre conversão acima). */
  blurIntensity: number;
  /**
   * `backdrop-saturate` do web, quando a superfície tem. NEM TODA tem:
   * cartões e a barra de navegação usam `backdrop-saturate-[180%]`, mas
   * as pílulas de contagem do Perfil (`ProfileHeader.tsx`) têm só
   * `backdrop-blur-md` — sem saturação nenhuma. Ausente aqui = não
   * aplica filtro, igual ao web.
   */
  saturate?: number;
  /**
   * CAUSA RAIZ DO "LEITOSO" (2026-09-16, achada no código-fonte REAL do
   * `expo-blur` instalado — `node_modules/expo-blur/android/.../
   * ExpoBlurView.kt` + `enums/TintStyle.kt`, versão `55.0.18`, não
   * documentação genérica nem suposição).
   *
   * O Android tem uma camada que o CSS `backdrop-filter` NÃO tem: o
   * `BlurView` nativo (`Dimezis/BlurView`, por baixo do `expo-blur`)
   * pinta um `overlayColor` PRÓPRIO por cima do blur, e o valor usado
   * pra calcular esse overlay é O MESMO número que a prop `intensity`
   * manda como raio de desfoque — sem divisão nenhuma:
   *
   *     // ExpoBlurView.kt
   *     private fun applyBlurViewOverlayColorCompat(useBlurView: Boolean) {
   *       ...
   *       blurView.setOverlayColor(tint.toBlurEffect(blurRadius))  // blurRadius = a prop `intensity`, CRUA
   *     }
   *
   *     // TintStyle.kt — tint "default" (o nosso, já que não passamos
   *     // `tint` nenhum) cai no `else`, que é BRANCO puro:
   *     private fun toColorInt(blurRadius: Float): Int {
   *       val intensity = blurRadius / 100
   *       return when (this) {
   *         ...
   *         else -> ((255 * intensity * 0.44).toInt() shl 24) + (255 shl 16) + (255 shl 8) + 255
   *       }
   *     }
   *
   * Ou seja: `overlayAlpha = (intensity/100) × 0.44`, cor
   * `rgb(255,255,255)` fixa — SEMPRE branco, pra qualquer intensidade
   * >0, e NENHUM valor de `tint` (nem `'default'`) zera isso (o `0.44`
   * é o multiplicador MAIS BAIXO de toda a tabela — não existe opção de
   * alfa zero). Com `blurIntensity: 55` isso dava
   * `(55/100)×0.44 ≈ 0.242` — quase 1/4 de branco puro por cima do
   * blur, ANTES do nosso `filter:[{saturate}]` sequer entrar (que por
   * isso nunca resolvia: `saturate` amplifica cor que existe, não
   * desfaz uma mistura pra branco que já aconteceu antes dele).
   *
   * A SAÍDA, achada no mesmo arquivo: o raio de desfoque REAL entregue
   * ao `Dimezis/BlurView` é `blurRadius / blurReductionFactor` — MAS o
   * overlay usa `blurRadius` CRU, sem dividir por
   * `blurReductionFactor`. As duas contas usam o MESMO número de
   * entrada (`intensity`) de formas DIFERENTES — isso quer dizer que dá
   * pra manter o raio de desfoque final (`intensity ÷
   * blurReductionFactor`) igual a antes, baixando os dois ao mesmo
   * tempo na MESMA proporção: o desfoque visível não muda (mesma
   * divisão), mas o `intensity` cru que vira overlay fica bem menor —
   * isso SEPARA desfoque e véu de cor, que é exatamente o que foi
   * pedido. Ver `blurReductionFactor` abaixo e o uso em `Glass.tsx`
   * (antes fixo em `1` pra TODA superfície de vidro — virou por
   * receita, só o `dock` muda).
   *
   * AINDA PRECISA DE CONFIRMAÇÃO VISUAL NO APARELHO — a conta é exata
   * (vem do código-fonte, não de medição em print), mas o RESULTADO
   * final (blur + saturate + base/highlight juntos) só se valida
   * olhando.
   */
  blurReductionFactor?: number;
  /**
   * TESTE AO VIVO (2026-09-16, a pedido — "faça isso", depois de provar
   * a causa do grão na tela `debug-grain.tsx`: painel 3 com
   * `applyNoise=true` mediu 3,34 de variação pixel-a-pixel; o mesmo
   * painel com `applyNoise=false` mediu 0,38 — quase 9× menos, grão
   * praticamente eliminado). Ver `ExpoBlurView.kt`/`BlurModule.kt`
   * (`node_modules/expo-blur`, patch de diagnóstico) — controla se o
   * `Dimezis/BlurView` nativo desenha por cima a textura de dithering
   * (`blue_noise.webp`, alfa 38/255) que causa o grão no Android.
   *
   * Ausente aqui = `true` (padrão da lib, comportamento de sempre — Ver
   * `Glass.tsx`, `applyNoise={recipe.applyNoise ?? true}`). Só `card`
   * usa `false` por enquanto, pra comparação ao vivo isolada — NENHUMA
   * outra receita (inclusive `dock`, que continua intocado) foi
   * alterada. Contrapartida já demonstrada na tela de diagnóstico: sem
   * o ruído, um banding leve (anel esverdeado na transição do brilho)
   * volta a aparecer — mais fraco que sem blur nenhum, mas perceptível.
   * Ainda precisa de confirmação visual no app real antes de decidir se
   * fica, se volta pro padrão, ou se vale patchar o alfa do ruído em vez
   * de desligar totalmente.
   */
  applyNoise?: boolean;
  border: string;
}

/**
 * DE VOLTA A `45 / 18` (2026-09-09, 2ª medição — a 1ª estava errada e
 * fica registrada porque o erro é instrutivo).
 *
 * A 1ª medição foi INDIRETA: vi que o card amplificava o fundo 1.03×
 * contra 1.73× do web, e que o lado escuro do card estava acima do web
 * e o iluminado abaixo. Chamei isso de "achatamento = desfoque demais",
 * calculei σb = 45 e, como o `blurIntensity` do card era 45, concluí
 * que a escala do `expo-blur` era o raio em dp. Troquei o fator 2.5
 * por 1.
 *
 * A 2ª medição é DIRETA, e desmente aquilo. Na barra de navegação, que
 * agora desfoca conteúdo de verdade, dá pra medir o desfoque pelo que
 * ele faz: quanto ele ALARGA as feições do que está atrás (largura de
 * correlação a meia altura, numa faixa sem ícone nem texto):
 *
 *                    atrás    dentro da barra    alargamento
 *     web              9            39              4.33×
 *     mobile          11            11              1.00×
 *
 * Com `intensity = 18` a barra não alarga NADA — não há desfoque. Dá
 * pra ver a olho: o texto "JACKSON" do pôster continua legível através
 * da barra do mobile, e no web nenhum texto sobrevive. Os 4.33× do web
 * correspondem a σ ≈ 16-18, ou seja o `blur(18px)` do CSS confere.
 *
 * Portanto 18 na escala do `expo-blur` é quase zero, e o `45 / 18`
 * original — que o comentário antigo dizia ter sido "validado no
 * aparelho" — estava certo. A conta de σb = 45 do card media outra
 * coisa; o que falta de amplificação lá é o `saturate` não entregando
 * os 1.8 pedidos, não desfoque a mais.
 */
const PX_TO_BLUR_INTENSITY = 45 / 18;

export const glassVariants: Record<GlassVariantName, GlassVariant> = {
  light: {
    base: "rgba(80,115,180,0.06)",
    highlight: "rgba(255,255,255,0.13)",
    highlightRadiusX: 75,
    highlightRadiusY: 100,
    highlightCenterX: 14,
    highlightCenterY: 15,
    highlightStop: 60,
    blurIntensity: Math.round(10 * PX_TO_BLUR_INTENSITY),
    /*
     * 1.6, não 1.8: os usos desta receita no web (`SectionTitle.tsx`,
     * `HomeTabs.tsx`, `GenreChips.tsx`, `ExploreTabs.tsx`) pedem
     * `backdrop-saturate-[160%]`. O 180% é dos CARTÕES.
     */
    saturate: 1.6,
    /*
     * ESTENDIDO (2026-09-16, a pedido — "estenda", depois do `card`
     * confirmado bom em 2 telas reais). Ver o comentário grande em
     * `applyNoise`, na interface `GlassVariant`, acima.
     */
    applyNoise: false,
    border: "rgba(255,255,255,0.1)",
  },
  card: {
    /*
     * REVERTIDO (2026-09-16) — toda a sequência de ajustes de `base`/
     * `highlight` desta receita (rodadas de "ilumina as manchas"/
     * "escurece o tom escuro") foi feita no alvo ERRADO: o pedido era
     * sobre a mancha azul do FUNDO (`AmbientGlow`/`lib/glowBlobs.ts`,
     * atrás do `GlassTargetProvider`), não sobre o brilho de canto
     * DENTRO do card `Glass`. Voltou pros valores originais; o ajuste
     * de verdade vai em `glowBlobs.ts`.
     */
    base: "rgba(80,115,180,0.10)",
    /*
     * AJUSTE (2026-09-16, a pedido — "diminui a mancha branca no glass
     * de estatística, está forte ainda... diminui uns 25%"). Esta é a
     * mancha de canto DENTRO do card mesmo (diferente da mancha de
     * fundo, essa é `HOME_GLOW_BLOBS`/`glowBlobs.ts`, ajustada em
     * separado): `0.17 × 0.75 ≈ 0.13`.
     *
     * RODADA 2 (2026-09-16, a pedido — "diminui a mancha branca de
     * estatísticas que ela tá muito forte", sem % desta vez): mesmo
     * corte de 25% de novo: `0.13 × 0.75 ≈ 0.0975 ≈ 0.10`.
     */
    highlight: "rgba(255,255,255,0.10)",
    highlightRadiusX: 75,
    highlightRadiusY: 100,
    highlightCenterX: 14,
    highlightCenterY: 15,
    highlightStop: 60,
    /*
     * MESMA CAUSA RAIZ DA BARRA DE NAVEGAÇÃO (2026-09-16, a pedido —
     * "está esbranquiçado, não era assim, estava igual web antes",
     * print do card de Estatísticas).
     *
     * NÃO mexi na barra (`dock`, intocada) nem em nenhum código deste
     * card — o `blurReductionFactor` fixo em `1` que existia antes da
     * Rodada 5 (ver `Glass.tsx`) sempre valeu pra TODAS as receitas,
     * `card` incluída. Ou seja este véu já existia antes de eu tocar em
     * qualquer coisa hoje; só nunca tinha sido medido/relatado aqui —
     * a barra foi a primeira porque foi o que você pediu primeiro.
     *
     * Mesma conta do `dock` (`ExpoBlurView.kt`/`TintStyle.kt`, ver o
     * comentário grande em `blurReductionFactor`, na interface acima):
     * véu branco = `(intensity/100) × 0.44`. Com `blurIntensity: 45` e
     * `blurReductionFactor` implícito em `1` (o padrão antes de existir
     * este campo), o véu era `(45/100)×0.44 ≈ 0.198` — quase 20% de
     * branco puro por cima do blur, em TODO card que usa esta receita
     * (23 usos no web, a mais comum das cinco).
     *
     * Mesmo tipo de correção: mantém o raio final de desfoque IGUAL
     * (`45`, o mesmo "alargamento" já calibrado — aqui, diferente da
     * barra, ninguém reportou problema de mistura de cor, só de véu, e
     * por isso o raio não muda) repartindo a proporção entre
     * `intensity` e `blurReductionFactor`: `45 → 6.75` /
     * `1 → 0.15` (mesmo fator `0.15` usado na Rodada 5 do `dock`) — raio
     * final `6.75 ÷ 0.15 = 45`, véu cai pra `(6.75/100)×0.44 ≈ 0.030`
     * (3%, contra ~20% antes).
     *
     * ESCOPO: esta receita (`card`) é usada em MUITAS superfícies do
     * app, não só no card de Estatísticas — a mudança vale pra todas
     * elas de uma vez (é a correção da causa, não um remendo local).
     * Ainda precisa de confirmação visual — primeira tentativa.
     */
    blurIntensity: 6.75,
    blurReductionFactor: 0.15,
    /*
     * TESTE DIAGNÓSTICO #2 (2026-09-16) — RESULTADO: grão continuou
     * visível sem `saturate`, só o card ficou menos colorido. Não
     * confirmou a causa — restaurado. `saturate` está DESCARTADO como
     * causa PRINCIPAL do grão (eliminação completa desta vez: eu vi o
     * resultado com ele desligado e o grão não sumiu), mas continua
     * valendo — sem ele o card perde o "acender com o fundo".
     */
    /*
     * RODADA 1 DE RECALIBRAÇÃO (2026-09-16, a pedido — "parece que no
     * mobile os cards glass tem uma cor azulada neles", print
     * comparando o card do "REACHER" web × mobile lado a lado, mesmo
     * conteúdo).
     *
     * MEDIÇÃO DIRETA no print (região lisa do card, longe de pôster/
     * texto/badge, várias amostras por lado):
     *
     *              web            mobile
     *     R          32             20
     *     G          44             55
     *     B          57             85
     *
     * "Distância da luminância" (magnitude de croma, mesma ideia do
     * `saturate` — luma = 0.213R+0.715G+0.072B):
     *     web:    luma≈42.4, croma≈18.0
     *     mobile: luma≈49.7, croma≈46.4
     *
     * Proporção mobile/web ≈ 2.58× mais saturado. Isso é uma ESTIMATIVA,
     * não uma conta exata como a do véu branco — diferente da barra, o
     * card do RN empilha uma camada própria (`base:
     * rgba(80,115,180,0.10)`, este arquivo) que o CSS do web não tem,
     * então "mesma entrada, multiplicador diferente" não é
     * necessariamente verdade aqui; a proporção medida assume que sim,
     * como primeiro palpite informado.
     *
     * Primeiro teste: `1.8 ÷ 2.58 ≈ 0.7`. AINDA PRECISA DE CONFIRMAÇÃO
     * VISUAL no aparelho, comparando o MESMO card (mesmo título, mesma
     * posição) antes/depois — não é valor final, é o ponto de partida
     * pra iterar (mesmo processo usado no `dock`).
     *
     * RODADA 2 (2026-09-16, a pedido — "diminuiu demais, não foque só
     * nos números investigue como está visualmente"). Print novo, MESMO
     * card (REACHER), mesma medição:
     *
     *              web            mobile (saturate=0.7)
     *     R          30             35
     *     G          55             49
     *     B          77             65
     *     croma     33.6            21.7
     *
     * Olhando visualmente, não só o número: o card ficou visivelmente
     * mais CINZA/lavado que o web — perdeu o tom azul-índigo, virou
     * quase monocromático. Confirma numericamente: a `0.7` o mobile
     * ficou 0.65× do croma do web (SUBSATURADO), enquanto a `1.8`
     * estava 2.58× (SUPERSATURADO) — passou direto do exagero pro
     * oposto, sem parar perto do alvo.
     *
     * A relação `saturate → croma` claramente NÃO é proporcional direta
     * (croma/web não vai a zero quando saturate→0 — tem uma camada de
     * cor de base que não depende do multiplicador). Com dois pontos
     * reais (1.8→2.58×; 0.7→0.65×), a reta que passa por eles cruza a
     * proporção 1.0× (igual ao web) em `saturate ≈ 0.90` — bem mais
     * perto de "sem alteração" (`1.0`) que dos dois extremos já
     * testados. Ainda é estimativa (só 2 pontos, modelo linear
     * aproximado) — próxima rodada de confirmação visual decide se para
     * aqui ou ajusta mais.
     */
    saturate: 0.9,
    /*
     * TESTE AO VIVO (2026-09-16, "faça isso") — ver o comentário grande
     * em `applyNoise`, na interface `GlassVariant` acima. Só esta
     * receita (`card`) desliga o ruído nativo, pra comparar ao vivo nas
     * telas reais que a usam sem tocar em `dock` nem nas outras.
     */
    applyNoise: false,
    border: "rgba(255,255,255,0.1)",
  },
  medium: {
    base: "rgba(80,115,180,0.09)",
    highlight: "rgba(255,255,255,0.16)",
    highlightRadiusX: 70,
    highlightRadiusY: 80,
    highlightCenterX: 20,
    highlightCenterY: 15,
    highlightStop: 60,
    blurIntensity: Math.round(14 * PX_TO_BLUR_INTENSITY),
    saturate: 1.8,
    /* ESTENDIDO (2026-09-16, "estenda") — ver `applyNoise` na interface `GlassVariant`, acima. */
    applyNoise: false,
    border: "rgba(255,255,255,0.1)",
  },
  /**
   * EXCEÇÃO DELIBERADA À CALIBRAÇÃO AZUL (2026-09-04) — esta receita é a
   * dos botões redondos que ficam SOBRE A FOTO de capa
   * (`GLASS_ICON_BTN` no `ProfileHeader.tsx` do web), não sobre o fundo
   * navy do app. O véu azul das outras receitas existe pra compensar a
   * composição contra um fundo escuro conhecido; aqui o que tem atrás é
   * uma fotografia qualquer, e o vidro precisa ser NEUTRO pra deixar a
   * cor dela mandar. Por isso volta o branco literal do web — se a capa
   * for marrom, o botão fica marrom; se for azul, fica azul.
   *
   * `blurIntensity` vem do `backdrop-blur-md` (12px) que o
   * `ProfileHeader.tsx` usa nesses botões — não dos 10px das outras
   * ocorrências da receita.
   */
  icon: {
    base: "rgba(255,255,255,0.10)",
    highlight: "rgba(255,255,255,0.26)",
    highlightRadiusX: 70,
    highlightRadiusY: 75,
    highlightCenterX: 25,
    highlightCenterY: 20,
    highlightStop: 65,
    /*
     * CAUSA RAIZ DO "ACESO"/BRILHO NO SINO E NO "..." (2026-09-16, a
     * pedido — "verifica porque o sino e (...) no mobile está
     * iluminado"). Investigando o código achei que esta receita
     * (`icon`) nunca recebeu a MESMA correção já aplicada em `light`,
     * `card`, `medium`, `dock`, `subtle`, `dark` e `pill` (ver o
     * comentário grande em `blurReductionFactor`, na interface
     * `GlassVariant`, acima): sem `blurReductionFactor` explícito
     * (implícito em `1`), o véu branco nativo do `Dimezis/BlurView`
     * (`(intensity/100) × 0.44`) usava o `intensity` CRU de `30`
     * (`Math.round(12 × PX_TO_BLUR_INTENSITY)`) → véu ≈ 13% de branco
     * puro por cima do blur — bem mais forte que os ~2-3% já corrigidos
     * nas outras receitas. Sobre a foto de capa (mais clara/colorida
     * que o fundo navy do app), esse véu somado ao `saturate: 1.8`
     * amplificando a cor já misturada é o candidato mais forte pra
     * explicar o efeito de "disco aceso" — mesma causa raiz, só que
     * nunca tinha sido corrigida aqui porque ninguém tinha reportado
     * esta receita especificamente antes.
     *
     * Mesma correção: mantém o raio final de desfoque igual (`30`)
     * repartindo a proporção `intensity`/`blurReductionFactor` (mesmo
     * fator `0.15` das outras): `30 → 4.5`, `blurReductionFactor: 1 →
     * 0.15` → raio final `4.5 ÷ 0.15 = 30` (idêntico), véu cai pra
     * `(4.5/100) × 0.44 ≈ 0.0198` (2%, contra ~13% antes).
     *
     * `saturate` mantido em `1.8` por enquanto — ainda não recalibrado
     * contra a foto real (diferente do `dock`, que teve medição
     * dedicada). Ainda precisa de confirmação visual: se o "aceso"
     * sumir só com o véu corrigido, `saturate` pode nem precisar mexer;
     * se sobrar, aí sim entra medição dedicada, igual foi feito pro
     * `dock`.
     */
    blurIntensity: 4.5,
    blurReductionFactor: 0.15,
    saturate: 1.8,
    /* ESTENDIDO (2026-09-16, "estenda") — ver `applyNoise` na interface `GlassVariant`, acima. */
    applyNoise: false,
    border: "rgba(255,255,255,0.15)",
  },
  /**
   * BARRA DE NAVEGAÇÃO (2026-09-09, medida no print do web) — mesma
   * geometria da receita `card` (o web usa a MESMA string de
   * `background` e o mesmo `backdrop-blur-[18px]` nas duas), com UMA
   * diferença deliberada: a base é BRANCA literal, não o azul
   * compensado.
   *
   * O porquê é o mesmo já documentado na receita `icon`: o véu azul das
   * outras receitas existe pra compensar a composição contra o fundo
   * navy CONHECIDO do app. A barra flutua sobre o que estiver rolando
   * embaixo — pôster, capa, lista — e um véu azul tingiria tudo isso de
   * azul. O web ali é `rgba(255,255,255,0.10)` puro.
   *
   * Conferência numérica no print do web (barra sobre o fundo escuro,
   * "Minhas listas"): fundo (11,16,24) → `saturate(180%)` → (7,16,31)
   * → + branco 0.10 → (32,40,53). Medido na barra: (33,39,51). A
   * receita bate.
   */
  dock: {
    /*
     * O branco literal do web. Uma rodada baixou isto pra 0.065, com
     * base numa medida de "quanto a barra clareia o que está atrás"
     * (web +18, mobile +27). Aquela medida foi feita quando a barra
     * ainda não desfocava nada — o +27 vinha do conteúdo nítido
     * aparecendo por baixo, não de véu a mais. Medida inválida,
     * revertida. Recalibrar só depois de ver a barra com o desfoque
     * funcionando.
     */
    base: "rgba(255,255,255,0.10)",
    highlight: "rgba(255,255,255,0.17)",
    highlightRadiusX: 75,
    highlightRadiusY: 100,
    highlightCenterX: 14,
    highlightCenterY: 15,
    highlightStop: 60,
    /*
     * CORREÇÃO EM DUAS RODADAS (a pedido, 2026-09-16 — "não foque
     * apenas em código e números, quero visualmente igual").
     *
     * RODADA 1 (`85`, revertida) — a hipótese: no web dá pra ver que
     * tem um pôster atrás, mas o detalhe (rosto, texto) some numa
     * mancha de cor; no mobile (intensidade 45) ainda dava pra LER o
     * pôster, então subi bastante a intensidade. ERRADO NA PRÁTICA —
     * print seguinte mostrou a barra praticamente CINZA CHAPADA, sem
     * cor nenhuma, pior que antes. CAUSA: essa escala do
     * `expo-blur`/`dimezisBlurViewSdk31Plus` não é linear até o fim —
     * perto de 85 (de uma escala 0-100) o desfoque já homogeneíza a
     * COR MÉDIA da faixa inteira embaixo da barra, não só o detalhe
     * fino. Depois disso não sobra quase gradiente de cor nenhum pra
     * o `saturate` amplificar (amplificar um cinza quase uniforme
     * continua dando cinza) — e eu tinha BAIXADO o `saturate` no mesmo
     * commit (achando que precisaria de menos reforço com mais blur),
     * o que só piorou o resultado nas duas direções ao mesmo tempo.
     *
     * RODADA 2 — o que o web faz de verdade, olhando com calma: o
     * desfoque dele é MODERADO (apaga detalhe fino — rosto, texto —
     * mas preserva a variação de cor REGIONAL — quente à esquerda,
     * frio à direita, transição suave, sem cinza uniforme). Isso é
     * mais perto do 45 original que do 85 — por isso a intensidade só
     * sobe um pouco (pra suavizar a costura dura vista na rodada
     * anterior), e o `saturate` volta a subir bastante (a variação
     * regional que sobra do blur moderado precisa de reforço forte pra
     * ficar tão vívida quanto o web). Ainda precisa de confirmação
     * visual no aparelho.
     */
    /*
     * RODADA 5 — CAUSA RAIZ CONFIRMADA NO CÓDIGO-FONTE (2026-09-16, ver
     * o comentário completo em `blurReductionFactor`, na interface
     * `GlassVariant` acima — leitura direta do
     * `ExpoBlurView.kt`/`TintStyle.kt` instalados, versão `55.0.18`, não
     * suposição).
     *
     * O teste da Rodada 4 (`blurIntensity: 4`) não confirmou nem
     * derrubou a hipótese de véu fixo — ele MUDOU DUAS COISAS ao mesmo
     * tempo (desfoque quase sumiu, cor melhorou), porque no Android o
     * `overlayColor` do `Dimezis/BlurView` usa o MESMO número que vira
     * raio de desfoque (`intensity`), sem separação nenhuma nativamente.
     * Baixar `intensity` sempre reduz as duas coisas juntas — por isso o
     * pôster ficou nítido demais (pouco blur) E menos leitoso (menos
     * véu) ao mesmo tempo.
     *
     * A CONTA REAL (lida direto do Kotlin): o raio de desfoque que
     * chega no `Dimezis/BlurView` é `intensity ÷ blurReductionFactor`;
     * o `overlayColor` (branco, tint "default") é
     * `(intensity/100) × 0.44` — usando `intensity` CRU, sem dividir por
     * `blurReductionFactor`. As duas conas usam a MESMA entrada de
     * jeitos diferentes — isso permite manter o raio de desfoque final
     * IGUAL (mesma divisão) baixando `intensity` E
     * `blurReductionFactor` NA MESMA PROPORÇÃO: o blur visível não muda,
     * o véu branco cai proporcionalmente.
     *
     * Antes: `intensity=55, blurReductionFactor=1` (implícito, fixo em
     * `Glass.tsx`) → raio final = 55/1 = 55, véu = (55/100)×0.44 ≈ 0.242
     * (24% de branco puro).
     *
     * Agora: mesma razão 55, mas repartida — `intensity=8.25,
     * blurReductionFactor=0.15` → raio final = 8.25/0.15 = 55 (IGUAL,
     * mesmo desfoque de antes) → véu = (8.25/100)×0.44 ≈ 0.036 (3.6% de
     * branco, contra 24% antes — quase 7× menor). `blurReductionFactor`
     * só divide o NÚMERO que vira raio pro Dimezis (ver `ExpoBlurView.kt`)
     * — não é resolução de cálculo nem afeta o grão documentado em
     * `Glass.tsx` (aquilo é uma característica DIFERENTE, do algoritmo
     * do `blurMethod`, já resolvida), então não deveria reintroduzir o
     * problema de granulado já corrigido.
     *
     * `saturate` mantido em `2.2` — com o véu branco quase eliminado, a
     * cor que sobra pro saturate amplificar já deveria ser a cor real do
     * blur, não mais uma mistura pré-lavada. Ainda precisa de
     * confirmação visual sobre pôster E sobre fundo escuro, como pedido.
     */
    /*
     * RODADA 6 (a pedido, 2026-09-16 — "sobre os pôsteres a barra
     * continua muito uniforme e acinzentada... não considere concluído
     * apenas porque a fórmula mantém o mesmo raio").
     *
     * Ponto correto: eu mantive o raio final em `55` (o mesmo de antes
     * da Rodada 5) só porque era o número já em uso — nunca tinha sido
     * validado que ESSE raio reproduz a mistura de cor do web, só que
     * batia com uma medição antiga de "alargamento de borda"
     * (comentário de `PX_TO_BLUR_INTENSITY`, acima: raio ≈ 45 ↔
     * `blur(18px)` do CSS). Alargar borda e preservar manchas de cor
     * regionais são coisas DIFERENTES — o Android pode homogeneizar mais
     * a cor média pro MESMO alargamento de contorno, dependendo do
     * algoritmo. O print confirmou: mesmo raio 55, cor mais uniforme e
     * acinzentada que o web sobre pôster — então o raio precisa DESCER,
     * não ficar preso ao valor antigo.
     *
     * `intensity` continua baixo (`8.25`, intocado — é ele que controla
     * o véu branco, já resolvido na Rodada 5: véu ≈ 3.6%, e o fundo
     * escuro já bateu no print). Só `blurReductionFactor` sobe —
     * pela fórmula (`raio = intensity ÷ blurReductionFactor`), SUBIR o
     * divisor DESCE o raio, sem mexer no véu (que só depende de
     * `intensity`, não de `blurReductionFactor` — ver Rodada 5).
     *
     * `0.15 → 0.33`: raio final `8.25 ÷ 0.33 ≈ 25` (era 55) — bem abaixo
     * até do `45` antigo, de propósito: o pedido explícito foi manchas
     * separadas, pôster ainda irreconhecível mas NÃO uniforme — e 45 já
     * tinha sido escolhido só pela métrica de alargamento de borda, sem
     * confirmar a mistura de cor. Ainda precisa de confirmação visual —
     * primeira tentativa desta rodada, não valor final. Comparar sobre o
     * MESMO trecho de pôster nas duas capturas (o print anterior linkou
     * cores diferentes atrás de cada barra, dificultando comparar).
     */
    blurIntensity: 8.25,
    blurReductionFactor: 0.33,
    saturate: 2.2,
    border: "rgba(255,255,255,0.06)",
  },
  /**
   * PÍLULAS DE CONTAGEM DO PERFIL (Seguindo/Seguidores/Comentários).
   * Elas NÃO usam a receita `card`: o `ProfileHeader.tsx` do web dá a
   * elas um `background` próprio —
   *
   *     radial-gradient(75% 90% at 22% 12%, rgba(255,255,255,0.18),
   *                     transparent 60%),
   *     rgba(255,255,255,0.10)
   *
   * com `backdrop-blur-md` (12px) e `border-white/10`. Centro,raios e
   * opacidade do brilho são todos diferentes dos da receita `card`
   * (0.17 em 75%/100% at 14%/15%).
   *
   * BASE BRANCA, não o azul compensado das outras receitas — e isto é
   * medição, não cópia do CSS. No print do web, a pílula do meio (a que
   * fica sobre fundo neutro) clareia o que está atrás em
   * (+33.4, +32.2, +32.2): igual nos três canais, ou seja véu BRANCO.
   * O azul das outras receitas existe pra compensar composição contra o
   * navy do app; aqui o web não compensa nada.
   *
   * A opacidade do brilho é 0.208 e não os 0.18 do web porque o PNG
   * pré-desfocado que faz o papel do `radial-gradient` (`glow-soft.png`,
   * ver `Glass.tsx`) tem alpha 0.867 no próprio centro, não 1.0 —
   * 0.18 / 0.867 = 0.208 devolve o pico do web. O resto do perfil dele
   * cai mais rápido que a rampa linear do CSS (0.31 contra 0.50 na
   * metade do raio), o que deixa o brilho mais concentrado no canto —
   * que é justamente o que o web mostra.
   */
  pill: {
    /**
     * 0.08, e não os 0.10 do web — medido (2026-09-09, 3ª rodada).
     *
     * O brilho do canto já bate: o excesso dele sobre a base da pílula
     * ficou (+39,+41,+42) contra (+38,+40,+43) do web, e a queda descendo
     * a borda esquerda também (+42,+33,+19,+9,+9 no web contra
     * +42,+30,+12,+9,+9 aqui). O que ainda lia como "brilho forte" era a
     * pílula INTEIRA mais clara, levantando o canto junto:
     *
     *     base da pílula do meio   web (36,39,44)   mobile (41,48,59)
     *
     * Parte disso é o fundo do app, que aqui está um degrau da escada
     * acima (28 de azul contra 20) e não tem conserto — está documentado
     * no `DITHER_COMPENSATED_BASE` do `Glass.tsx`. O resto, ~5 níveis
     * iguais nos três canais, é véu a mais: `0.10 − 5/255 = 0.08`.
     */
    base: "rgba(255,255,255,0.08)",
    highlight: "rgba(255,255,255,0.208)",
    highlightRadiusX: 75,
    highlightRadiusY: 90,
    highlightCenterX: 22,
    highlightCenterY: 12,
    highlightStop: 60,
    /*
     * MESMA CAUSA RAIZ DA BARRA/CARD (2026-09-16, a pedido — "esqueceu
     * das pílulas Seguindo/Seguidores/Comentários"). Ver o comentário
     * completo em `blurReductionFactor`, na interface `GlassVariant`, e
     * o histórico igual na receita `card`, acima — mesmo véu branco do
     * `expo-blur` no Android (`(intensity/100)×0.44`), e esta receita
     * também estava com `blurReductionFactor` implícito em `1`.
     *
     * Raio antigo: `30` (`Math.round(12 × PX_TO_BLUR_INTENSITY)`), véu
     * ≈ `(30/100)×0.44 ≈ 0.132` (13%). Mesma proporção `0.15` das outras
     * duas correções, mantendo o raio final igual: `30 → 4.5`,
     * `blurReductionFactor: 1 → 0.15`, raio final `4.5÷0.15=30`
     * (idêntico), véu cai pra `(4.5/100)×0.44 ≈ 0.020` (2%).
     */
    blurIntensity: 4.5,
    blurReductionFactor: 0.15,
    /*
     * ESTENDIDO (2026-09-16, a pedido — "esses cards continuam com
     * grain", reportado nas pílulas Seguindo/Seguidores/Comentários
     * depois de eu esquecer de incluir esta receita na leva anterior).
     * Ver `applyNoise` na interface `GlassVariant`, acima.
     */
    applyNoise: false,
    border: "rgba(255,255,255,0.1)",
  },
  /**
   * SINO/"..." DO BANNER DE PERFIL (2026-09-16, a pedido — "corrige o
   * sino e o (...) que ainda estão iluminados, verifique a causa raiz").
   *
   * CAUSA RAIZ achada por MEDIÇÃO de pixel (print real, web × mobile,
   * disco do sino e disco de "..." nos dois), não suposição: a hipótese
   * anterior (troca pra `pill` pra tirar o `saturate: 1.8` da `icon`)
   * NÃO era a causa — medido em HSV, a SATURAÇÃO do mobile está mais
   * BAIXA que a do web (12-23% contra 29% do web), não mais alta. O que
   * bate muito mais claro é o VALOR/BRILHO: disco do sino, V=80-86% no
   * mobile contra 50-53% no web — quase 30 pontos de sobra, mesmo já
   * com `saturate` removido e o véu do `blurReductionFactor` corrigido.
   *
   * Ou seja: nem o `saturate` nem o véu nativo do `expo-blur` eram (mais)
   * o problema — é a própria opacidade de `base`/`highlight` da receita
   * usada (`pill`: 0.08/0.208). Esses valores foram medidos e aprovados
   * pras pílulas Seguindo/Seguidores/Comentários, que ficam sobre um
   * fundo ESCURO SÓLIDO (`colors.surface`) — aqui o alvo é a FOTO DE
   * CAPA, naturalmente mais clara, e o disco é pequeno (36px) e REDONDO:
   * a mesma geometria de brilho em PORCENTAGEM (`highlightRadiusX/Y`,
   * `highlightStop`) que rende um brilho de CANTO discreto numa pílula
   * larga cobre quase o disco INTEIRO num círculo pequeno — dois fatores
   * empilhados (base+brilho sobre fundo já claro, cobertura proporcional
   * maior) que a troca de receita anterior não endereçava.
   *
   * Corte inicial (a confirmar visualmente, mesma metodologia iterativa
   * já usada nas outras calibrações): `base`/`highlight` cortados pela
   * metade em relação à `pill` (0.08→0.04, 0.208→0.09) — raio de
   * desfoque/véu nativo e `border` continuam os mesmos já corrigidos.
   */
  bannerIcon: {
    base: "rgba(255,255,255,0.04)",
    highlight: "rgba(255,255,255,0.09)",
    highlightRadiusX: 75,
    highlightRadiusY: 90,
    highlightCenterX: 22,
    highlightCenterY: 12,
    highlightStop: 60,
    blurIntensity: 4.5,
    blurReductionFactor: 0.15,
    applyNoise: false,
    border: "rgba(255,255,255,0.1)",
  },
  /**
   * PRATELEIRA VAZIA (`EmptyShelf.tsx`). É a receita mais FRACA do web
   * e não coincide com nenhuma outra:
   *
   *     radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.10),
   *                     transparent 60%),
   *     rgba(255,255,255,0.04)
   *     border border-dashed border-white/15
   *     backdrop-blur-[10px] backdrop-saturate-[160%]
   *
   * A `light`, que é a mais próxima, usa 0.13/0.06 e borda 0.10 — mais
   * forte nos três. O comentário do web chama esta de "toque leve", e
   * faz sentido: é um espaço VAZIO, não deve competir com conteúdo.
   *
   * Base branca, não o azul compensado: a caixa aparece em telas
   * diferentes, sobre fundos diferentes.
   */
  subtle: {
    base: "rgba(255,255,255,0.04)",
    highlight: "rgba(255,255,255,0.10)",
    highlightRadiusX: 75,
    highlightRadiusY: 100,
    highlightCenterX: 14,
    highlightCenterY: 15,
    highlightStop: 60,
    blurIntensity: Math.round(10 * PX_TO_BLUR_INTENSITY),
    saturate: 1.6,
    /* ESTENDIDO (2026-09-16, "estenda") — ver `applyNoise` na interface `GlassVariant`, acima. */
    applyNoise: false,
    border: "rgba(255,255,255,0.15)",
  },
  dark: {
    base: "rgba(20,22,30,0.85)",
    highlight: "rgba(255,255,255,0.17)",
    highlightRadiusX: 75,
    highlightRadiusY: 100,
    highlightCenterX: 14,
    highlightCenterY: 15,
    highlightStop: 60,
    blurIntensity: Math.round(18 * PX_TO_BLUR_INTENSITY),
    saturate: 1.8,
    /* ESTENDIDO (2026-09-16, "estenda") — ver `applyNoise` na interface `GlassVariant`, acima. */
    applyNoise: false,
    border: "rgba(255,255,255,0.1)",
  },
};

export const glass = {
  /** Blur da receita "cartão" — mantido pra quem já lia daqui. */
  blurIntensity: glassVariants.card.blurIntensity,
  /** Borda clara sutil — mesmo papel do `border-white/10` do web. */
  borderNeutral: glassVariants.card.border,
  /**
   * MANTIDO SÓ POR COMPATIBILIDADE — não usar em código novo. O brilho
   * virou radial de canto (`glassVariants`), não mais um degradê linear
   * de ponta a ponta; ver a nota estrutural acima.
   */
  gradientNeutral: ["rgba(255,255,255,0.13)", "rgba(255,255,255,0.06)"] as const,
} as const;

/** "Gel" âmbar — versão OPACA (não translúcida, sem blur) do vidro, pra CTA primário/pílula em destaque. Mesma receita do botão amber do web. */
export const gel = {
  /**
   * CORREÇÃO (2026-09-04, medição do botão mobile × web — "está mais
   * laranja") — as opacidades estavam MAIS ALTAS que as do web
   * (0.95/0.92/0.95 contra 0.88/0.85/0.9). Mais opaco sobre o mesmo
   * âmbar = mais saturado, e era isso que dava o laranja vivo em vez do
   * dourado sóbrio. Agora são os valores literais do
   * `radial-gradient` de `StatisticsCard.tsx` do web.
   */
  gradient: ["rgba(240,169,79,0.88)", "rgba(232,163,61,0.85)", "rgba(176,95,27,0.9)"] as const,
  /**
   * Onde cada parada do gradiente cai — o web usa `0% / 42% / 100%`. Sem
   * isso o `LinearGradient` distribui em 0/50/100, e o tom médio ficava
   * baixo demais, achatando a descida até o âmbar escuro da base.
   */
  gradientLocations: [0, 0.42, 1] as const,
  /**
   * PERFIL CALIBRADO (2026-09-04) — só pro caso `webCalibrated` do
   * `GelSurface`. As 3 paradas do CSS descrevem um RADIAL; convertidas
   * pra uma linear vertical elas descem em linha reta, e o botão ficava
   * marrom já na metade. O perfil real do web, medido linha a linha no
   * canal R (0 = topo do botão, 1 = base):
   *
   *     altura   web   mobile-antes
   *      10%     211       210
   *      30%     211       205
   *      50%     201       195
   *      70%     204       184     <- 20 de diferença
   *      90%     179       170
   *
   * Ou seja o web fica PLANO no dourado até ~35%, tem um platô longo no
   * meio e só desaba nos últimos ~15%. Motivo: o radial do web nunca
   * chega na 3ª parada dentro da caixa do botão — ele cobre só parte da
   * rampa. Uma linear de 3 paradas percorre a rampa inteira, e por isso
   * escurecia cedo.
   *
   * Estas 4 paradas são a curva do web lida de volta: cada cor foi
   * obtida invertendo a composição (`Rg = (medido - 3.9) / 0.87`) e
   * reinterpolando sobre a própria rampa do CSS — nenhuma cor nova foi
   * inventada, são pontos DE DENTRO do gradiente original.
   */
  gradientCalibrated: [
    "rgba(240,169,79,0.88)",
    "rgba(238,168,75,0.87)",
    "rgba(224,153,56,0.86)",
    "rgba(191,113,36,0.89)",
  ] as const,
  gradientCalibratedLocations: [0, 0.35, 0.7, 1] as const,
  /** Reflexo claro no topo — aproximação do inset box-shadow do web (RN não tem sombra interna). */
  highlight: ["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"] as const,
  /**
   * A sombra interna de baixo do "gel" (`inset 0 -4px 7px
   * rgba(120,66,10,0.4)` no web) — estava literal dentro do
   * `GelSurface`; virou valor nomeado porque a versão AZUL precisa da
   * mesma coisa com outra cor.
   */
  insetBottom: "rgba(120,66,10,0.4)" as const,
  /**
   * A BORDA do "gel", uma cor por lado — os valores que estão no
   * `gelWrap` do `Glass.tsx` desde a rodada em que o botão "Ver
   * detalhes" foi aprovado. Vieram pra cá porque agora têm dois donos:
   * o botão e a cápsula das abas.
   *
   * São cores OPACAS, não o `border-white/15` do web, e isso é
   * deliberado: a caixa tem `overflow: "hidden"` e o degradê é filho
   * absoluto, então ele para na caixa de padding — uma borda com alfa
   * comporia com o que está ATRÁS da caixa, não com o gel, e sairia
   * acinzentada. Os valores abaixo são o resultado já composto, medido
   * contra o print do web.
   */
  border: {
    top: "rgb(230,180,114)",
    bottom: "rgb(213,162,93)",
    left: "rgb(211,166,104)",
    right: "rgb(211,166,104)",
  } as const,
} as const;

/**
 * "Gel" AZUL — a mesma pílula do `gel` acima, na cor que o web usa
 * quando a aba "Em breve" está ativa (`HomeTabs.tsx`):
 *
 *     radial-gradient(130% 170% at 28% 18%,
 *       rgba(90,165,235,0.9) 0%, rgba(58,133,206,0.88) 42%,
 *       rgba(24,78,140,0.92) 100%)
 *     inset 0 1px 0 rgba(255,255,255,0.35),
 *     inset 0 -4px 7px rgba(10,50,90,0.4)
 *
 * O porquê está no comentário do web: "Em breve" é sobre o que ainda
 * vai chegar, não sobre o que já se acompanha — a cor diferencia isso
 * de cara. Mesmas paradas (0/42/100) do âmbar.
 */
export const gelBlue = {
  gradient: ["rgba(90,165,235,0.9)", "rgba(58,133,206,0.88)", "rgba(24,78,140,0.92)"] as const,
  gradientLocations: [0, 0.42, 1] as const,
  /**
   * A versão CALIBRADA, equivalente ao `gel.gradientCalibrated` — é
   * esta que as abas usam, porque o pedido foi "no HomeTabs o design é
   * o mesmo do botão VER DETALHES", e aquele botão usa a calibrada.
   *
   * Como saiu: as 3 paradas do web reamostradas em 4 (0 / 0.35 / 0.7 /
   * 1, iguais às do âmbar) e depois clareadas pelo MESMO delta que a
   * calibração do âmbar aplicou em cada parada — +5/+4/+11 na segunda,
   * +19/+23/+11 na terceira, +15/+18/+9 na quarta. Aquele delta veio de
   * medir o print: o degradê linear do RN devolve o radial do web mais
   * escuro no meio e embaixo, e isso é da RENDERIZAÇÃO, não da matiz —
   * por isso vale igual no azul.
   *
   * RESSALVA REGISTRADA: o delta é herdado, não medido no azul. Quando
   * houver um print com "Em breve" ativo, vale reconferir.
   */
  gradientCalibrated: [
    "rgba(90,165,235,0.9)",
    "rgba(68,142,222,0.87)",
    "rgba(61,129,185,0.86)",
    "rgba(39,96,149,0.89)",
  ] as const,
  gradientCalibratedLocations: [0, 0.35, 0.7, 1] as const,
  highlight: ["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"] as const,
  insetBottom: "rgba(10,50,90,0.4)" as const,
  /**
   * A borda do gel azul. Mesma natureza da âmbar (opaca, já composta),
   * obtida pela MESMA conta que gerou aquela: `branco 15%` sobre a cor
   * do degradê naquele lado, mais o delta que a medição do âmbar
   * mostrou contra o print do web — topo (−12,−2,+9), base
   * (+12,+28,+24), lados (−18,−2,+18).
   *
   * RESSALVA REGISTRADA: o delta é herdado do âmbar, não medido no
   * azul. Vale reconferir quando houver print com "Em breve" ativo.
   */
  border: {
    top: "rgb(103,176,247)",
    bottom: "rgb(83,148,189)",
    left: "rgb(72,146,214)",
    right: "rgb(72,146,214)",
  } as const,
} as const;

/**
 * "Plus Jakarta Sans" (a pedido — "perfil não se parece com o web") —
 * o web instalou essa fonte de verdade, app-wide, via `next/font/google`
 * (`apps/web/app/layout.tsx`, pesos 400-800, ver sessão do redesign
 * "vidro" 2026-08-21); o mobile nunca teve fonte customizada nenhuma,
 * usava a fonte padrão do sistema (Roboto/San Francisco) — uma das
 * causas reais de "não parece o mesmo app".
 *
 * React Native não tem "peso variável" pra fonte customizada como o
 * `font-weight: 700` do CSS: cada peso do Google Fonts é um ARQUIVO
 * (e um nome de `fontFamily`) diferente — `fontWeight: "700"` sozinho,
 * sem trocar o `fontFamily`, não deixa nada em negrito (o SO só sabe
 * fingir negrito/itálico em fontes DO SISTEMA, não em TTF custom
 * carregado pelo app). Por isso o mapa + `fontFamilyForWeight` abaixo:
 * o componente `Text` (`components/ui/Text.tsx`) resolve o
 * `fontFamily` certo a partir do `fontWeight` pedido (variant OU
 * style local), em vez de cada tela escolher a fonte na mão — mesma
 * ideia de token central do resto deste arquivo.
 */
export const fontFamily = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
} as const;

/**
 * Pesos que a fonte instalada não cobre (ex.: "300", "900", "black") —
 * caem no peso existente mais PRÓXIMO por cima, nunca quebram nem
 * caem silenciosamente pro padrão do sistema.
 */
export function fontFamilyForWeight(weight?: number | string): string {
  const numeric = weight === "bold" ? 700 : weight === "normal" || weight === undefined ? 400 : Number(weight);
  if (!Number.isFinite(numeric)) return fontFamily[400];
  if (numeric >= 800) return fontFamily[800];
  if (numeric >= 700) return fontFamily[700];
  if (numeric >= 600) return fontFamily[600];
  if (numeric >= 500) return fontFamily[500];
  return fontFamily[400];
}
