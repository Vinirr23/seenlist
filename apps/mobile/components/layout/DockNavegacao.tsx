import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Animated, Easing, View, Pressable, Text as RNText, StyleSheet } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, fontFamily, radius, spacing } from "@/lib/theme";
import { Glass } from "@/components/ui/Glass";
import { fetchUnreadRecommendationsCount } from "@/lib/recommendations";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
// DIAGNÓSTICO TEMPORÁRIO (2026-09-17) — ver `lib/perfNavStamp.ts`. REMOVER junto.
import { marcarToqueNaAba } from "@/lib/perfNavStamp";

const UNREAD_POLL_INTERVAL_MS = 30_000;

/**
 * A MESMA imagem de brilho já desfocada que o `AmbientGlow`
 * (`components/ui/Glass.tsx`) usa pras manchas de fundo — ver o
 * comentário longo lá pro histórico: um `LinearGradient` circular NÃO
 * é um desfoque (fica com borda nítida), e a solução validada no
 * aparelho foi trocar por um PNG que já nasce borrado, colorido via
 * `tintColor`. Aqui vale o mesmo motivo: o brilho da aba ativa no web
 * é `radial-gradient(...)` + `filter: blur(6px)`, e RN não tem nenhum
 * dos dois.
 */
const GLOW_IMAGE = require("../../assets/images/glow-soft.png");

/**
 * CORREÇÃO (2026-09-04, erro real de `tsc --noEmit` reportado pelo
 * usuário: "Argument of type 'string | undefined' is not assignable to
 * parameter of type 'string'" em `t(labelKey)`) — causa raiz: estes
 * dois mapas estavam como `Record<string, ...>` (chave ABERTA), e o
 * `tsconfig.base.json` do monorepo liga `noUncheckedIndexedAccess`:
 * indexar mapa de chave aberta devolve `X | undefined`, sempre. Não é
 * o `t()` que está errado — ele exige `string` com razão.
 *
 * Fix pela raiz, sem `!` e sem `?? ""` (que só calariam o compilador e
 * deixariam uma rota sem tradução passar em silêncio): a chave virou
 * uma UNIÃO FECHADA (`TabRouteName`). Com chave literal conhecida, o
 * `noUncheckedIndexedAccess` não acrescenta `undefined` — e, de
 * quebra, esquecer de cadastrar uma aba nova em QUALQUER um dos dois
 * mapas passa a ser erro de compilação, em vez de aba sem rótulo
 * descoberta só no aparelho.
 */
type TabRouteName = "series" | "movies" | "explore" | "profile";

/**
 * CORREÇÃO (2026-09-09, comparado ícone a ícone com o print do web — "a
 * barra de navegação não está igual ao web") — a aba Filmes usava o
 * `film` do Feather, que é uma TIRA DE FILME (retângulo com furos de
 * arrasto dos dois lados). O web usa o `Clapperboard` do lucide
 * (`lib/navigation.ts`): uma CLAQUETE — corpo retangular com a barra
 * diagonal listrada em cima. São dois desenhos diferentes, não duas
 * versões do mesmo.
 *
 * As outras três batem: `Tv`, `Compass` e `User` do lucide têm
 * equivalente direto no Feather (`tv`, `compass`, `user`) — mesmo
 * traço, mesma silhueta.
 *
 * A claquete não existe no Feather, então essa ÚNICA aba vem do
 * MaterialCommunityIcons (`movie-open-outline`), que é a claquete
 * aberta. Daí o tipo virar uma união etiquetada em vez de
 * `keyof typeof Feather.glyphMap`: as duas famílias têm mapas de nome
 * diferentes, e misturar os dois num `Record` de chave aberta traria de
 * volta o `undefined` do `noUncheckedIndexedAccess`.
 *
 * O certo de verdade é a migração pro `lucide-react-native` (pausada a
 * pedido) — quando ela voltar, isto some e as quatro abas vêm do mesmo
 * pacote que o web usa.
 */
type TabIcon =
  | { family: "feather"; name: keyof typeof Feather.glyphMap }
  | { family: "material"; name: keyof typeof MaterialCommunityIcons.glyphMap };

const ROUTE_ICON: Record<TabRouteName, TabIcon> = {
  series: { family: "feather", name: "tv" },
  movies: { family: "material", name: "movie-open-outline" },
  explore: { family: "feather", name: "compass" },
  profile: { family: "feather", name: "user" },
};

/** Desenha o ícone da aba na família certa — ver `ROUTE_ICON`, acima. */
function TabIconView({ icon, color, size }: { icon: TabIcon; color: string; size: number }) {
  if (icon.family === "feather") return <Feather name={icon.name} color={color} size={size} />;
  /*
   * O `movie-open-outline` nasce com o traço mais grosso e a silhueta
   * um pouco menor dentro da caixa que os do Feather (é um contorno de
   * forma preenchida, não um traço de 2px). +2px de tamanho iguala a
   * altura ÓPTICA da claquete à da TV e da bússola ao lado.
   */
  return <MaterialCommunityIcons name={icon.name} color={color} size={size + 2} />;
}

const ROUTE_LABEL_KEY: Record<TabRouteName, string> = {
  series: "nav.series",
  movies: "nav.movies",
  explore: "nav.explore",
  profile: "nav.profile",
};

/**
 * A ORDEM DAS ABAS, explícita. Antes ela vinha do `state.routes` do
 * navegador; agora a barra é renderizada FORA dele (ver `RootLayout`,
 * em `app/_layout.tsx`) e a lista precisa existir aqui. É a mesma ordem do
 * `tabs` do web (`lib/navigation.ts`), sem o Feed — que continua
 * existindo como rota, só não aparece na barra.
 */
const ABAS: readonly TabRouteName[] = ["series", "movies", "explore", "profile"];

/**
 * O caminho de cada aba. Literal (não `\`/${nome}\``) pro expo-router
 * conseguir checar a rota em tempo de compilação quando `typedRoutes`
 * estiver ligado.
 */
const ROUTE_HREF = {
  series: "/series",
  movies: "/movies",
  explore: "/explore",
  profile: "/profile",
} as const satisfies Record<TabRouteName, string>;

/** Estreita o segmento de rota (string livre do expo-router) pras 4 abas reais. */
function isTabRoute(name: string | undefined): name is TabRouteName {
  return name !== undefined && name in ROUTE_ICON;
}

/**
 * PORTE DO WEB (2026-09-04, auditoria "mobile 100% igual ao web") —
 * "Floating Glass Dock", o desenho final da barra de navegação do web
 * (`apps/web/components/layout/BottomNavigation.tsx` +
 * `BottomNavigationItem.tsx`, últimas rodadas de refinamento de
 * 2026-08-26). Troca completa do padrão antigo (barra sólida, largura
 * cheia, encostada no rodapé, contorno dourado sólido na aba ativa)
 * por: dock flutuante, vidro (`Glass`), largura fixa de 284px
 * centralizada, cantos arredondados, com um brilho âmbar difuso atrás
 * do ícone ativo + um traço fino embaixo dele (sem pílula sólida) —
 * exatamente os valores finais que o web chegou depois de 2 rodadas de
 * compactação (barra 404→360→284px, coluna de item ~101→84→67px,
 * traço 22×3→16×2px, caixa do ícone 36×36→24×24px).
 *
 * Números todos copiados 1:1 do CSS/valores do web (`DOCK_*`/`ITEM_*`
 * abaixo) — só a técnica muda (RN não tem `radial-gradient`/
 * `backdrop-filter` nativos, ver `components/ui/Glass.tsx`).
 *
 * DESFOQUE DA BARRA — histórico, em três passos, porque cada um
 * eliminou uma hipótese:
 *   1. alvo PRÓPRIO com um véu chapado dentro: desfocar uma cor lisa
 *      não é vidro, é véu — barra escura e neutra.
 *   2. SEM alvo nenhum: no Android não desfoca nada (a doc do Expo diz
 *      isso com todas as letras) — o pôster aparecia cru.
 *   3. alvo = o CONTEÚDO DE TELA, com a barra fora dele. É o que está
 *      valendo; a conta que levou até aqui está em `RootLayout` (`app/_layout.tsx`).
 *
 * Bolinha de aviso (recomendação não lida) — web mostra só um PONTO
 * (`h-2.5 w-2.5 rounded-full`), sem número. Mobile antes mostrava a
 * CONTAGEM (\"9+\"). Trocado pro ponto simples, igual ao web — perde o
 * número exato, mas é o que \"igual ao web\" pede; a contagem
 * (`unreadCount`) continua sendo buscada, só decide MOSTRAR o ponto ou
 * não (`> 0`), não o texto.
 */
const DOCK_MAX_WIDTH = 284;
const DOCK_PADDING_H = spacing.sm; // 8 — mesmo valor do `px-2` do web (2ª compactação)
const DOCK_RADIUS = radius.lg; // 16 — mesmo valor do `rounded-2xl`
const DOCK_FLOATING_GAP = spacing.md - 4; // 12 — mesmo valor do `bottom-3` do web
const ITEM_GLOW_W = 60;
const ITEM_GLOW_H = 52;
/**
 * CORREÇÃO (2026-09-04, print real do emulador comparado com print do
 * web) — o brilho da aba ativa estava saindo como um DISCO ÂMBAR
 * SÓLIDO, de borda definida: exatamente a "pílula sólida" que o web
 * removeu de propósito na rodada "Floating Glass Dock". Causa raiz: eu
 * tinha portado `radial-gradient(closest-side, rgba(232,163,61,0.32),
 * rgba(232,163,61,0.10) 55%, transparent 80%)` + `filter: blur(6px)`
 * como um `backgroundColor` liso com `borderRadius` — cor uniforme até
 * a borda, que é visualmente o oposto de um brilho que se dissolve.
 *
 * Fix: mesma técnica já validada no aparelho pro `AmbientGlow` (PNG
 * pré-desfocado + `tintColor`), com a mesma conta de espalhamento
 * documentada em `Glass.tsx`: um blur gaussiano de raio R fica
 * imperceptível a ~3R, então a caixa da imagem cresce 3 × 6px = 18px
 * por lado em relação à caixa do web, mantendo o CENTRO no mesmo
 * lugar. A opacidade (0.32) é o valor do centro do radial do web —
 * sem o reforço de 1.68 do `AmbientGlow`, que foi calibrado pras
 * manchas grandes de fundo, não pra um brilho pequeno de 60×52.
 */
const ITEM_GLOW_BLUR_PX = 6; // `filter: blur(6px)` do web
const ITEM_GLOW_SPREAD = ITEM_GLOW_BLUR_PX * 3; // 18 — mesma regra do `BLUR_VISIBLE_SPREAD_PX` em Glass.tsx
const ITEM_GLOW_OPACITY = 0.32; // parada central do radial do web
const ITEM_GLOW_TINT = "rgb(232,163,61)"; // colors.primary, sem alpha (o alpha vira `opacity`)
const ITEM_GLOW_TOP = 4; // `top-1` do Tailwind = 0.25rem = 4px (estava 1px por engano)
const ITEM_STROKE_W = 16;
const ITEM_STROKE_H = 2;
const ICON_BOX_SIZE = 24; // h-6 w-6 — era 36×36 (caixa invisível que afastava ícone/legenda no web, mesmo bug já corrigido lá)
const ICON_SIZE = 20;
const ICON_LABEL_GAP = 2;
const ITEM_PADDING_V = 10; // py-2.5

function dockItemWidth(itemCount: number): number {
  return (DOCK_MAX_WIDTH - DOCK_PADDING_H * 2) / itemCount;
}

function dockGlowLeft(index: number, itemCount: number): number {
  const columnWidth = dockItemWidth(itemCount);
  return DOCK_PADDING_H + index * columnWidth + (columnWidth - ITEM_GLOW_W) / 2;
}

function dockStrokeLeft(index: number, itemCount: number): number {
  const columnWidth = dockItemWidth(itemCount);
  return DOCK_PADDING_H + index * columnWidth + (columnWidth - ITEM_STROKE_W) / 2;
}

/**
 * O DOCK NÃO TEM ALVO DE DESFOQUE PRÓPRIO (2026-09-09, medido).
 *
 * Ele tinha um, contendo só um véu chapado — ou seja, o `BlurView` da
 * barra passava o tempo todo desfocando uma cor lisa. Isso não produz
 * vidro, produz véu cinza. Medido na barra, no vão entre os ícones:
 *
 *                    web            mobile (com alvo próprio)
 *     topo      (107,102, 98)        ( 66, 68, 73)
 *     base      ( 70, 83, 84)        ( 43, 46, 52)
 *
 * Além de escura, era NEUTRA: a do web puxa pro tom do que passa por
 * trás. Agora o alvo vem de fora, por contexto — é a `BlurTargetView`
 * do conteúdo de tela (ver `RootLayout`, em `app/_layout.tsx`).
 */

export function DockNavegacao({ alvoDaTela }: { alvoDaTela: RefObject<View | null> }) {
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);
  const { t } = useTranslation();
  const router = useRouter();
  /*
   * CORREÇÃO DE CAUSA RAIZ (2026-09-17, typecheck real — "Tuple type
   * '[string]' of length '1' has no element at index '1'" em
   * `segmentos[1]` abaixo) — `useSegments()` do expo-router, com rotas
   * tipadas ativas, infere o tipo como a união literal de TODOS os
   * caminhos de rota do app — e o tipo "mais largo" em comum entre
   * eles, hoje, é uma tupla de 1 posição só. Isso não bate com o uso
   * daqui: este componente não quer um caminho de rota tipado
   * específico, quer os segmentos da URL atual como uma lista
   * genérica (tamanho variável) pra ler a posição 0 e 1 na mão — é
   * exatamente o caso de uso que a própria documentação do expo-router
   * recomenda tratar como `string[]` genérico, não como a tupla
   * tipada. `as string[]` preserva o comportamento de sempre (o
   * acesso por índice abaixo já era escrito supondo `string |
   * undefined`, por causa do `noUncheckedIndexedAccess` do
   * tsconfig) — só destrava o typecheck, sem mudar nada em runtime.
   */
  const segmentos = useSegments() as string[];

  useEffect(() => {
    let cancelled = false;
    function refresh() {
      fetchUnreadRecommendationsCount().then((count) => {
        if (!cancelled) setUnreadCount(count);
      });
    }
    refresh();
    const interval = setInterval(refresh, UNREAD_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  /*
   * Qual aba está aberta. A fonte é a própria URL (fora do navegador
   * não existe `state.index`).
   *
   * A BARRA AGORA MORA NA RAIZ (2026-09-09, decisão do usuário — "a
   * barra de navegação não está aparecendo em várias telas"), então os
   * segmentos são os da raiz, não os de dentro de `(tabs)`:
   *
   *     dentro de uma aba   ["(tabs)", "series", ...]   → aba "series"
   *     tela empilhada      ["series", "[id]"]          → NENHUMA aba
   *
   * Essa segunda linha é de propósito e copia o web: lá o item ativo é
   * `pathname === tab.href`, comparação EXATA — dentro de
   * `/series/123` nenhuma aba acende e os dois indicadores (brilho e
   * traço) somem, mas a barra continua na tela. Sem o teste de
   * `"(tabs)"` aqui, `/series/123` acenderia a aba Séries, que é o
   * contrário do que o web faz.
   *
   * `segmentos[n]` é `string | undefined` por causa do
   * `noUncheckedIndexedAccess`; `isTabRoute` já trata isso, então não
   * entra `!` nem `?? ""` aqui.
   */
  const abaAtual = segmentos[0] === "(tabs)" ? segmentos[1] : undefined;
  const activeIndex = isTabRoute(abaAtual) ? ABAS.indexOf(abaAtual) : -1;
  const columnWidth = dockItemWidth(ABAS.length);

  /**
   * PORTE DO WEB (2026-09-09, a pedido — "adicione a animação de slide
   * igual ao web no mobile"). No web os dois indicadores (o brilho
   * âmbar e o traço) têm `transition-[left] duration-300 ease-out` e a
   * troca de aba é só uma mudança de `left` — o navegador interpola.
   * Aqui não existe transição implícita: o `left` pulava direto pra
   * posição nova.
   *
   * O valor animado é a POSIÇÃO DA ABA (0, 1, 2, 3), igual ao
   * `activeIndex` que o web usa na fórmula do `left` — e vira pixel na
   * interpolação (1 casa = 1 coluna). Isso é `translateX`, não `left`,
   * por um motivo prático: `left` não roda no driver nativo (é layout),
   * `transform` roda — a animação acontece na thread de UI e não trava
   * junto com a navegação que está acontecendo no mesmo instante. O
   * resultado na tela é idêntico: os dois elementos continuam
   * ancorados na coluna 0 e são empurrados N colunas pra direita.
   *
   * `Easing.bezier(0, 0, 0.58, 1)` é literalmente o `ease-out` do CSS
   * (a curva que o `transition-timing-function: ease-out` usa), e 300ms
   * é o `duration-300` do web.
   *
   * O valor inicial já nasce na aba ativa (`Math.max(activeIndex, 0)`)
   * — sem isso o app abriria com o brilho deslizando da primeira aba
   * até a aba atual toda vez que a barra montasse.
   */
  const posicaoAba = useRef(new Animated.Value(Math.max(activeIndex, 0))).current;
  useEffect(() => {
    if (activeIndex < 0) return;
    Animated.timing(posicaoAba, {
      toValue: activeIndex,
      duration: 300,
      easing: Easing.bezier(0, 0, 0.58, 1),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, posicaoAba]);
  /* `extrapolate` padrão é "extend": a casa 2 vira 2 × coluna sozinha. */
  const deslocamento = posicaoAba.interpolate({ inputRange: [0, 1], outputRange: [0, columnWidth] });

  return (
    <View style={[styles.dockWrap, { bottom: insets.bottom + DOCK_FLOATING_GAP }]} pointerEvents="box-none">
      <View style={styles.dockGlassTarget}>
        {/*
          O alvo de desfoque da barra é a `BlurTargetView` que envolve o
          CONTEÚDO DE TELA (ver `RootLayout`, em `app/_layout.tsx`), não um alvo próprio — é
          isso que faz ela pegar a cor do que está atrás, como no web.
        */}
        <Glass style={styles.dock} variant="dock" blurTarget={alvoDaTela}>
          {activeIndex >= 0 && (
            <>
              {/* `pointerEvents` é prop de `View`, não de `Image` — daí a View em volta (mesma caixa do dock, geometria inalterada). */}
              {/*
                Os dois indicadores ficam ancorados na COLUNA 0 e são
                empurrados pelo `translateX` animado — ver o comentário
                em `posicaoAba`, acima. Por isso o `dockGlowLeft`/
                `dockStrokeLeft` recebem 0 aqui, e não `activeIndex`.
              */}
              <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                <Animated.Image
                  source={GLOW_IMAGE}
                  resizeMode="cover"
                  style={[
                    styles.activeGlow,
                    {
                      left: dockGlowLeft(0, ABAS.length) - ITEM_GLOW_SPREAD,
                      transform: [{ translateX: deslocamento }],
                    },
                  ]}
                />
              </View>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.activeStroke,
                  {
                    left: dockStrokeLeft(0, ABAS.length),
                    transform: [{ translateX: deslocamento }],
                  },
                ]}
              >
                <LinearGradient
                  colors={["rgba(240,169,79,0.4)", "rgba(232,163,61,1)", "rgba(240,169,79,0.4)"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.activeStrokeFill}
                />
              </Animated.View>
            </>
          )}
          {ABAS.map((nome, indice) => {
            const icon = ROUTE_ICON[nome];
            const labelKey = ROUTE_LABEL_KEY[nome];
            const focused = indice === activeIndex;

            /*
             * `navigate` (e não `push`) porque é troca de ABA: se a aba
             * já estiver na pilha, volta pra ela em vez de empilhar uma
             * segunda cópia. É o mesmo comportamento do `<Link>` do web.
             *
             * O `navigation.emit("tabPress")` de antes saiu junto com o
             * `BottomTabBarProps` — conferido antes de tirar: nada no
             * app escutava esse evento (nenhum `addListener("tabPress")`
             * em lugar nenhum), ele só era emitido.
             */
            function handlePress() {
              if (!focused) {
                // DIAGNÓSTICO TEMPORÁRIO (2026-09-17) — ver `lib/perfNavStamp.ts`. REMOVER junto.
                marcarToqueNaAba();
                router.navigate(ROUTE_HREF[nome]);
              }
            }

            return (
              <Pressable key={nome} onPress={handlePress} style={styles.tabItem}>
                <View style={styles.iconBox}>
                  <TabIconView icon={icon} color={focused ? colors.primary : "rgba(140,147,168,0.7)"} size={ICON_SIZE} />
                  {nome === "profile" && unreadCount > 0 && <View style={styles.badgeDot} />}
                </View>
                <RNText
                  style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}
                  numberOfLines={1}
                >
                  {t(labelKey)}
                </RNText>
              </Pressable>
            );
          })}
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dockWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  dockGlassTarget: {
    width: DOCK_MAX_WIDTH,
  },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: DOCK_RADIUS,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: DOCK_PADDING_H,
    /*
     * SEM VÉU, de propósito — ver o bloco em `RootLayout` (`app/_layout.tsx`). Enquanto a
     * barra não desfocava nada, um véu era a única forma de ela existir
     * na tela, e nenhuma cor/alfa dava certo (véu mistura na direção de
     * uma cor fixa; o web deixa a cor de trás passar a 91%). Agora que
     * o desfoque é real, a receita do web se aplica direto: o branco
     * 10% e o brilho radial vêm da variante `dock` (`lib/theme.ts`), e
     * nada mais entra por cima.
     */
    /**
     * Sobrescreve a sombra padrão do `Glass` (`0 10px 30px rgba(0,0,0,0.35)`,
     * pensada pra cartão dentro da tela). O web usa `shadow-lg
     * shadow-black/20` aqui de propósito — o comentário lá diz "sombra
     * mais suave, pra a barra parecer flutuar sobre o conteúdo em vez
     * de ser uma caixa em cima dele". Estes são os dois níveis do
     * `shadow-lg` do Tailwind com a cor trocada pra preto 20%.
     */
    boxShadow: [
      { offsetX: 0, offsetY: 10, blurRadius: 15, spreadDistance: -3, color: "rgba(0,0,0,0.2)" },
      { offsetX: 0, offsetY: 4, blurRadius: 6, spreadDistance: -4, color: "rgba(0,0,0,0.2)" },
    ],
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: ICON_LABEL_GAP,
    paddingVertical: ITEM_PADDING_V,
  },
  iconBox: {
    height: ICON_BOX_SIZE,
    width: ICON_BOX_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "600",
    fontFamily: fontFamily[600],
  },
  labelInactive: {
    color: colors.muted,
    fontFamily: fontFamily[400],
  },
  badgeDot: {
    position: "absolute",
    top: 0,
    right: 0,
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  /**
   * Ver o bloco de comentário em `ITEM_GLOW_BLUR_PX`, acima — imagem
   * pré-desfocada tingida de âmbar, caixa 18px maior por lado que a do
   * web (pra caber o espalhamento do `blur(6px)`), centro no mesmo
   * lugar. Sem `borderRadius`/`backgroundColor`: a forma e a suavidade
   * vêm do alpha da própria imagem, não de uma caixa recortada.
   */
  activeGlow: {
    position: "absolute",
    top: ITEM_GLOW_TOP - ITEM_GLOW_SPREAD,
    width: ITEM_GLOW_W + ITEM_GLOW_SPREAD * 2,
    height: ITEM_GLOW_H + ITEM_GLOW_SPREAD * 2,
    tintColor: ITEM_GLOW_TINT,
    opacity: ITEM_GLOW_OPACITY,
  },
  activeStroke: {
    position: "absolute",
    bottom: 4,
    width: ITEM_STROKE_W,
    height: ITEM_STROKE_H,
    borderRadius: ITEM_STROKE_H / 2,
    /* O degradê agora é FILHO (a caixa de fora é a que anima) — sem isso ele passaria por cima das pontas arredondadas. */
    overflow: "hidden",
  },
  activeStrokeFill: {
    flex: 1,
  },
});
