import { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, StyleSheet, type LayoutChangeEvent } from "react-native";
import { Text } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, spacing, radius, fontSize, fontFamily, motion } from "@/lib/theme";
import type { FeedScope } from "@/lib/posts";

/**
 * A PEDIDO (2026-10-01 — "a aba feed na parte superior não tem nada,
 * o que você recomenda?") — o Feed começava direto no primeiro post,
 * sem "topo de tela" nenhum. Header compacto: título "Feed" (mesmo
 * texto de `nav.feed`, sem chave nova pra não duplicar) + as duas abas
 * "Para você"/"Seguindo" — dá estrutura ao topo e, principalmente, dá
 * uma função concreta de verdade ao sistema de seguir usuários (hoje
 * só existe pra lista de seguidores/perfil, nunca filtrava o Feed).
 *
 * Deliberadamente sem card/Glass/fundo ao redor — só tipografia e uma
 * linha fina sob a aba ativa (texto branco + âmbar embaixo; inativa
 * fica cinza). Sem logo, saudação, busca, estatísticas ou carrossel
 * aqui — o Feed já é vertical o bastante, o topo só orienta.
 *
 * CENTRALIZADO (2026-10-01, a pedido depois de ver no emulador — "quero
 * que o título 'feed' e 'for you e following' centralizados"): troca do
 * alinhamento à esquerda original. `alignItems: "center"` no `wrapper`
 * basta — título e a `View` das abas encolhem pro tamanho do próprio
 * conteúdo (deixam de esticar) e ficam centralizados como blocos.
 *
 * SUBLINHADO DESLIZANTE (2026-10-01, documento de UX — "ao trocar For
 * you → Following, o underline desliza, em vez de simplesmente
 * desaparecer/reaparecer") — antes cada aba desenhava o PRÓPRIO
 * sublinhado (`alignSelf: "stretch"` dentro da coluna de cada `tab`,
 * visível só quando `active`); trocar de aba era um sublinhado
 * sumindo e outro aparecendo no mesmo instante, sem movimento. Agora
 * existe UM sublinhado só, posicionado em `position: "absolute"`
 * dentro de `tabs` (que virou `position: "relative"` pra servir de
 * referência) — cada `FeedScopeTab` mede a própria posição/largura via
 * `onLayout` (coordenadas já relativas a `tabs`, não à tela) e guarda
 * em `tabLayouts`; um `useEffect` anima `left`/`width` do sublinhado
 * pra bater com a aba ativa toda vez que `scope` muda. Na PRIMEIRA
 * medição da aba já ativa, salta direto pro lugar (`setValue`, sem
 * animar) — sem isso, o sublinhado nasceria encolhido em `x:0,
 * width:0` e "cresceria" visivelmente ao abrir a tela, antes mesmo de
 * qualquer troca de aba.
 */
export function FeedHeader({ scope, onChangeScope }: { scope: FeedScope; onChangeScope: (scope: FeedScope) => void }) {
  const { t } = useTranslation();
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<FeedScope, { x: number; width: number }>>>({});
  const underlineLeft = useRef(new Animated.Value(0)).current;
  const underlineWidth = useRef(new Animated.Value(0)).current;
  const hasPositioned = useRef(false);

  useEffect(() => {
    const target = tabLayouts[scope];
    if (!target) return;
    if (!hasPositioned.current) {
      underlineLeft.setValue(target.x);
      underlineWidth.setValue(target.width);
      hasPositioned.current = true;
      return;
    }
    Animated.parallel([
      Animated.timing(underlineLeft, { toValue: target.x, duration: motion.normal, useNativeDriver: false }),
      Animated.timing(underlineWidth, { toValue: target.width, duration: motion.normal, useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `underlineLeft`/`underlineWidth` são `Animated.Value` estáveis (useRef), não precisam entrar nas deps.
  }, [scope, tabLayouts]);

  function handleTabLayout(key: FeedScope, e: LayoutChangeEvent) {
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) => (prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }));
  }

  return (
    <View>
      <View style={styles.wrapper}>
        <Text variant="title">{t("nav.feed")}</Text>
        <View style={styles.tabs}>
          <FeedScopeTab
            label={t("feed.forYou")}
            active={scope === "forYou"}
            onPress={() => onChangeScope("forYou")}
            onLayout={(e) => handleTabLayout("forYou", e)}
          />
          <FeedScopeTab
            label={t("feed.following")}
            active={scope === "following"}
            onPress={() => onChangeScope("following")}
            onLayout={(e) => handleTabLayout("following", e)}
          />
          <Animated.View style={[styles.underline, { left: underlineLeft, width: underlineWidth }]} />
        </View>
      </View>
      {/*
       * LINHA SEPARANDO O HEADER DO CONTEÚDO (2026-10-01, a pedido —
       * referência do X: uma linha fina logo abaixo das abas "Para
       * você"/"Seguindo", separando o cabeçalho de onde os posts
       * começam). Fica FORA de `wrapper` de propósito — `wrapper` tem
       * padding horizontal (`spacing.md`) pro título/abas não
       * colarem na borda da tela, mas a linha precisa ir de ponta a
       * ponta (igual a referência), então não pode herdar esse
       * padding.
       */}
      <View style={styles.divider} />
    </View>
  );
}

function FeedScopeTab({
  label,
  active,
  onPress,
  onLayout,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  return (
    <Pressable onPress={onPress} onLayout={onLayout} hitSlop={8} style={styles.tab}>
      <Text style={active ? styles.tabLabelActive : styles.tabLabelInactive}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    // BUG REAL CORRIGIDO (2026-10-01, reportado — "a linha na
    // referência não é embaixo, é colada em 'for you e following'")
    // — era `spacing.md` (16px), abrindo um vão visível entre o
    // sublinhado e a linha divisória; a referência do X cola a linha
    // logo abaixo das abas. `spacing.sm` (8px) é só o suficiente pra
    // limpar o sublinhado (`underline`, `bottom: -6` + `height: 2`
    // dentro de `tabs` — ponta mais baixa do sublinhado fica 6px
    // abaixo do fim de `tabs`), sem sobra.
    paddingBottom: spacing.sm,
    alignItems: "center",
  },
  tabs: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
    position: "relative",
  },
  tab: {
    alignItems: "flex-start",
  },
  tabLabelActive: {
    fontSize: fontSize.smPlus,
    color: colors.text,
    fontWeight: "700",
    fontFamily: fontFamily[700],
  },
  tabLabelInactive: {
    fontSize: fontSize.smPlus,
    color: colors.muted,
    fontWeight: "600",
    fontFamily: fontFamily[600],
  },
  // Antes era desenhado DENTRO de cada `tab` (ver comentário grande
  // acima); agora é um único elemento, posicionado por `left`/`width`
  // animados, ancorado em `tabs` (que agora é a referência de posição).
  underline: {
    position: "absolute",
    bottom: -6,
    height: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  // Linha de ponta a ponta (2026-10-01, a pedido, referência do X) —
  // mesma receita visual já usada entre os cards do Feed
  // (`StyleSheet.hairlineWidth` + `colors.border`), só que aqui
  // separa o cabeçalho (título + abas) de onde os posts começam.
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
