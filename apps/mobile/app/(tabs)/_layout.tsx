import { useEffect, useRef, useState } from "react";
import { View, Pressable, Text as RNText, Animated, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, motion } from "@/lib/theme";
import { fetchUnreadRecommendationsCount } from "@/lib/recommendations";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const UNREAD_POLL_INTERVAL_MS = 30_000;

/**
 * A PEDIDO — margem intencional entre a barra e a borda de baixo da
 * tela, e mais respiro no topo dos itens (ícone/rótulo coladas na
 * borda superior antes). Fixo, de propósito: não depende de
 * `insets.bottom`, que em aparelho com navegação de 3 botões pode
 * legitimamente vir zero (ver comentário completo em `styles.tabBar`).
 */
/*
 * CORREÇÃO (a pedido — "você subiu a barra, não é pra subir") —
 * `TOP_PADDING` foi removido. A causa real do "subiu": a barra é
 * ancorada por BAIXO (`bottom: BOTTOM_MARGIN`), então aumentar a
 * ALTURA dela (`TOP_PADDING` somava na altura total) empurra o topo
 * pra cima — é isso que "subir" significa aqui, diferente de
 * "afastar da borda de baixo" (que é só o `BOTTOM_MARGIN`, e não
 * muda a altura da barra, só a posição dela). Os dois efeitos
 * pareciam a mesma coisa, mas não são.
 *
 * `BOTTOM_MARGIN` sozinho continua de pé — ele É o afastamento leve
 * do sistema que foi pedido, sem crescer a barra.
 */
export const BOTTOM_MARGIN = 6;
/** Cápsula voltou a ocupar a coluna inteira — a pedido, revertendo o tamanho fixo/centralizado da tentativa anterior. */

const ROUTE_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  series: "tv",
  movies: "film",
  explore: "compass",
  profile: "user",
};

const ROUTE_LABEL_KEY: Record<string, string> = {
  series: "nav.series",
  movies: "nav.movies",
  explore: "nav.explore",
  profile: "nav.profile",
};

/**
 * TASK-090 — mesmas 5 abas e mesma ordem do web
 * (`apps/web/lib/navigation.ts`): Séries, Filmes, Feed, Explorar,
 * Perfil. Ícones via `@expo/vector-icons` (Feather) em vez de
 * `lucide-react-native` — evita adicionar mais uma dependência
 * nativa nova; `@expo/vector-icons` já vem dentro do pacote `expo`
 * (histórico da EAS: cota de build já estourou uma vez, então cada
 * dependência nova evitada é um risco a menos).
 *
 * TASK-169 — badge de recomendações não lidas, redesenhado à mão
 * (ver abaixo) — busca de novo a cada 30s enquanto o app está
 * aberto — não é tempo real (evita gastar conexão do Supabase
 * Realtime só por isso), atualiza rápido o bastante pra não parecer
 * travado.
 *
 * Redesign (a pedido, 3ª rodada — achado real: mesmo desenhando o
 * conteúdo dentro de `tabBarIcon`, o React Navigation reserva um
 * ESPAÇO FIXO pro slot de ícone, pensado pra conteúdo de largura
 * constante — a pílula (mais larga que um ícone sozinho, só quando
 * ativa) ficava cortada por esse limite, em vez de simplesmente
 * ocupar mais espaço) — a solução de verdade é parar de usar
 * `tabBarIcon`/`tabBarLabel` (o sistema padrão) e desenhar a barra
 * inteira à mão, via prop `tabBar` — controle total, sem nenhum
 * limite escondido de tamanho.
 *
 * Ajuste (a pedido) — a barra deixou de ser flutuante (cantos
 * arredondados, margem de 16 dos dois lados, sombra) e virou FIXA:
 * borda a borda, encostada no fundo de verdade (`left/right/bottom:
 * 0`), fundo sólido (não mais semi-transparente) e uma borda
 * superior fina em vez de sombra. `useTabBarClearance()` (o cálculo
 * de espaço reservado que TODA tela com lista usa, pra não ficar
 * escondendo o último item atrás da barra) foi atualizado junto —
 * não tinha mais os 12px de margem que existiam antes.
 */
/**
 * A PEDIDO — cápsula deslizante por trás da aba ativa, espelhando a
 * mesma ideia da web (`BottomNavigation.tsx`). Antes, o destaque era
 * uma pílula que só existia (ou não) na aba ativa — trocar de aba
 * fazia o rótulo "pipocar", sem nenhum movimento entre as posições.
 * Agora existe UMA cápsula só, que desliza da posição antiga pra
 * nova — e por isso o rótulo passou a ficar SEMPRE visível nas 4
 * abas (antes só aparecia na ativa): a cápsula precisa de algo fixo
 * pra deslizar por trás, senão o "salto" de layout (ícone sozinho →
 * ícone+texto) atrapalharia a animação.
 */
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  /*
   * CORREÇÃO (revertendo um diagnóstico errado meu) — cheguei a
   * limitar este valor a um teto artificial (34, emprestado da
   * altura da barra de gestos do iPhone — nada a ver com Android),
   * achando que `insets.bottom` vinha "inflado" nesse aparelho. Era
   * engano: aparelho com navegação de 3 botões PRECISA de mais
   * espaço mesmo (frequentemente ~48dp ou mais) — o valor do sistema
   * provavelmente sempre esteve certo. O teto cortava um valor
   * legítimo, recriando o bug antigo (barra encostando nos botões
   * do sistema) que já tinha sido corrigido antes desta sessão. A
   * causa real do "tamanho bugado" era só a cápsula em si (já
   * corrigida, ver comentário nela abaixo), não este valor.
   */
  const safeInset = insets.bottom;
  const [unreadCount, setUnreadCount] = useState(0);
  /*
   * CORREÇÃO (bug real, reportado com print — "a barra não desliza")
   * — a versão anterior usava `translateX` com PORCENTAGEM
   * (`"25%"`, `"50%"`...). Diferente do CSS na web, o `transform` do
   * React Native não é confiável com string de porcentagem — só
   * aceita número (pixel de verdade). Funcionava "por acaso" na
   * posição inicial (0% sempre vira 0, não importa o motor), mas
   * falhava ao tentar deslizar pra qualquer outra posição.
   *
   * Corrigido medindo a largura REAL da barra (`onLayout`, só
   * dispara depois que o layout já existe de verdade) e movendo em
   * pixel — a forma que o React Native sempre suporta, sem
   * depender de porcentagem em transform.
   */
  const [barWidth, setBarWidth] = useState(0);
  const { t } = useTranslation();

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
   * `state.routes` inclui a aba "feed" escondida (ela continua
   * registrada em `<Tabs.Screen>`, só não aparece — `href: null` tira
   * da navegação visível, não da lista). Se a cápsula usasse o índice
   * CRU de `state`, ela deslizaria pra posição errada sempre que a
   * aba ativa estivesse depois do Feed na lista (Explorar/Perfil) —
   * por isso filtra ANTES de calcular qualquer posição.
   */
  const visibleRoutes = state.routes.filter((route) => ROUTE_ICON[route.name] && ROUTE_LABEL_KEY[route.name]);
  const activeVisibleIndex = visibleRoutes.findIndex((route) => route.key === state.routes[state.index]?.key);

  const capsuleAnim = useRef(new Animated.Value(activeVisibleIndex)).current;
  useEffect(() => {
    if (activeVisibleIndex < 0) return;
    Animated.timing(capsuleAnim, { toValue: activeVisibleIndex, duration: motion.normal, useNativeDriver: true }).start();
  }, [activeVisibleIndex, capsuleAnim]);

  /*
   * REVERTIDO (a pedido, com print circulado mostrando o tamanho
   * correto) — cápsula volta a ocupar a coluna inteira. A tentativa
   * anterior (largura fixa de 84, centralizada) não era o que se
   * queria — o tamanho já estava certo antes dela.
   */
  const itemWidth = barWidth / (visibleRoutes.length || 1);
  const capsuleTranslate = capsuleAnim.interpolate({
    inputRange: visibleRoutes.map((_, i) => i),
    outputRange: visibleRoutes.map((_, i) => i * itemWidth),
  });

  return (
    <View
      style={[styles.tabBar, { height: 56 + safeInset, paddingBottom: safeInset }]}
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      {activeVisibleIndex >= 0 && barWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.capsule,
            {
              width: itemWidth,
              transform: [{ translateX: capsuleTranslate }],
            },
          ]}
        />
      )}
      {visibleRoutes.map((route) => {
        const icon = ROUTE_ICON[route.name]!;
        const labelKey = ROUTE_LABEL_KEY[route.name]!;
        const focused = route.key === state.routes[state.index]?.key;

        function handlePress() {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        return (
          <Pressable key={route.key} onPress={handlePress} style={styles.tabItem}>
            <View style={styles.iconWrapper}>
              <Feather name={icon} color={focused ? colors.primary : colors.muted} size={22} />
              {route.name === "profile" && unreadCount > 0 && (
                <View style={styles.badge}>
                  <RNText style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</RNText>
                </View>
              )}
            </View>
            <RNText style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {t(labelKey)}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="series" options={{ title: "Séries" }} />
      <Tabs.Screen name="movies" options={{ title: "Filmes" }} />
      {/*
       * DECISÃO DE PRODUTO (a pedido, com base em dado real do painel
       * de observabilidade) — aba Feed descontinuada. Os números: 20
       * follows entre 383 usuários, 3 posts em 7 dias,
       * posts/comentários por usuário ativo em 0,0. Sem grafo social,
       * o Feed é estruturalmente uma tela vazia — e era a maior fonte
       * de bug do app (crash em produção, Realtime quebrado).
       *
       * REVERSÍVEL: a rota (`app/(tabs)/feed.tsx`) e todo o código
       * continuam existindo — `href: null` só tira da barra. Voltar é
       * trocar por `options={{ title: "Feed" }}` e devolver as duas
       * entradas em ROUTE_ICON/ROUTE_LABEL_KEY acima.
       *
       * O social que FUNCIONA continua: avaliações com texto (1.324,
       * nota média 4,27), comentários de episódio, recomendar, seguir.
       */}
      <Tabs.Screen name="feed" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ title: "Explorar" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    /*
     * A PEDIDO (bug real, reportado com print — barra encostada direto
     * nos botões do sistema, sem respiro nenhum) — aparelho com
     * navegação de 3 botões pode reportar `insets.bottom` como ZERO
     * de verdade: a área dos botões já fica reservada pelo sistema
     * FORA da tela do app, então não sobra "inset" nenhum pra
     * reportar — não é bug de leitura, é comportamento correto do
     * sistema nesse modo. `bottom: BOTTOM_MARGIN` (fixo, somado ao
     * que já vier de `insets.bottom`) garante um respiro mínimo
     * sempre, não importa o que o sistema reporte.
     */
    position: "absolute",
    left: 0,
    right: 0,
    bottom: BOTTOM_MARGIN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  capsule: {
    /*
     * CORREÇÃO (bug real, reportado com print — cápsula colada em
     * cima, com folga só embaixo) — a versão anterior usava altura
     * FIXA (44), pensada como proteção contra `insets.bottom`
     * inflado. Essa suposição era enganada (ver correção grande logo
     * acima, em `safeInset`) — altura fixa nunca fez sentido: ela não
     * se adapta à altura de verdade do conteúdo (ícone+rótulo), então
     * sobrava folga só de um lado.
     *
     * `top`+`bottom` SIMÉTRICOS (6 dos dois lados) resolve isso —
     * a cápsula se ajusta sozinha à altura real do item, sempre com
     * o mesmo respiro em cima e embaixo, não importa o valor exato.
     */
    position: "absolute",
    top: 6,
    left: 0,
    bottom: 6,
    borderRadius: 14,
    backgroundColor: colors.primary + "26",
    borderWidth: 1,
    borderColor: colors.primary + "66",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
  },
  iconWrapper: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    color: colors.muted,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
});
