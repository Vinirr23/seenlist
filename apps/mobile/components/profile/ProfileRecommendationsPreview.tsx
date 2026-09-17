import { memo, useCallback, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { fetchReceivedRecommendations, type ReceivedRecommendation } from "@/lib/recommendations";
import { tmdbImageUrl } from "@/lib/library";
import { Text, Skeleton, Glass } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { colors, radius, spacing, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const AVATAR_SIZE = 32;

/**
 * Porta de `ProfileRecommendationsPreview.tsx` do web (já incluindo
 * os ajustes feitos lá: frase completa em até 2 linhas em vez de
 * truncar, selo de não-lida sobre os avatares em vez de linha de
 * texto própria, e contorno/fundo de destaque no card quando tem
 * recomendação não lida). Busca de novo toda vez que a aba Perfil
 * ganha foco, mesmo padrão que já existia aqui pra contagem de
 * não-lidas.
 */
/**
 * CORREÇÃO (2026-09-15, item deixado de fora de propósito em
 * 2026-09-03, retomado agora — "nome em negrito dentro da frase de
 * recomendação") — no web o nome de quem recomendou vem dentro de um
 * `<span className="font-semibold">` (`ProfileRecommendationsPreview.tsx`,
 * as 3 variações da frase); aqui a frase inteira saía de `t()` já
 * pronta, como uma string só — sem como negritar só um pedaço por
 * dentro de um `Text` sem RECONSTRUIR a frase.
 *
 * As 3 traduções (`profile.recommendedSingle`/`recommendedPlusTitles`/
 * `recommendedByMultiplePeople`, `translations.ts`) começam TODAS com
 * o molde `{sender}` — chamando `t(key)` SEM o 2º argumento devolve o
 * molde com os placeholders ainda literais (mesmo truque já usado em
 * `highlightTitle.tsx`, pra "Porque você assistiu a [X]"), então dá
 * pra dividir no `{sender}` (sempre o nome inteiro, um pedaço só) e
 * negritar exatamente esse pedaço, preenchendo o resto (`{title}`/
 * `{count}`/`{noun}`) manualmente — funciona em qualquer idioma, sem
 * hard-codar posição.
 */
function interpolarResto(texto: string, vars: Record<string, string | number>) {
  let resultado = texto;
  for (const [nome, valor] of Object.entries(vars)) {
    resultado = resultado.replace(`{${nome}}`, String(valor));
  }
  return resultado;
}

function fraseComNomeEmNegrito(molde: string, nome: string, vars: Record<string, string | number>) {
  /*
   * CORREÇÃO DE CAUSA RAIZ (2026-09-17, typecheck real — "Argument of
   * type 'string | undefined' is not assignable to parameter of type
   * 'string'" em `interpolarResto(prefixo, vars)` logo abaixo) —
   * `String.prototype.split` devolve `string[]` genérico; com
   * `noUncheckedIndexedAccess` ligado, desestruturar a 1ª posição de
   * um array genérico sempre vira `string | undefined` pro
   * TypeScript, mesmo `.split()` sempre devolvendo pelo menos 1
   * elemento na prática (nunca array vazio). `sufixo` já tinha esse
   * default (`= ""`); faltava o mesmo em `prefixo` — mesmo raciocínio,
   * mesma correção.
   */
  const [prefixo = "", sufixo = ""] = molde.split("{sender}");
  return (
    <>
      {interpolarResto(prefixo, vars)}
      <Text style={styles.messageSenderName}>{nome}</Text>
      {interpolarResto(sufixo, vars)}
    </>
  );
}
/**
 * MEMOIZADO (2026-09-17, causa raiz do "delay na mudança de abas" —
 * ver `Glass.tsx`/`app/(tabs)/profile.tsx`) — zero props; só
 * recalcula pelo próprio estado interno, nunca por um hook irmão de
 * `ProfileScreen` resolvendo e re-renderizando o pai.
 */
export const ProfileRecommendationsPreview = memo(function ProfileRecommendationsPreview() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [recommendations, setRecommendations] = useState<ReceivedRecommendation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      fetchReceivedRecommendations(locale)
        .then((data) => {
          if (!cancelled) setRecommendations(data);
        })
        .catch((error) => {
          console.error("[ProfileRecommendationsPreview] Falha ao buscar recomendações", error);
          if (!cancelled) setRecommendations([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [locale])
  );

  if (isLoading && recommendations === null) {
    /*
     * CORREÇÃO (auditoria — "loaders diferentes") — era uma caixa
     * cinza ESTÁTICA, sem animação, enquanto o resto do app usa o
     * `Skeleton` pulsante. Duas linguagens de carregamento no mesmo
     * Perfil, uma parecendo "conteúdo quebrado" e a outra
     * "carregando".
     */
    return <Skeleton width="100%" height={80} />;
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Pressable onPress={() => router.push("/profile/recommendations")}>
        <Glass style={styles.card}>
          <View style={styles.emptyIcon}>
            <Feather name="send" size={16} color={colors.primary} />
          </View>
          <Text numberOfLines={1} style={styles.title}>
            {t("profile.recommendationsTitle")}
          </Text>
          <Text variant="muted" style={styles.emptyLabel}>
            {t("profile.noRecommendationsShort")}
          </Text>
          {/*
            CORREÇÃO (2026-09-04, medido no print do web a pedido — "no
            web não tem nem a mancha circular ao redor do ícone e nem a
            seta ao lado de 'nenhuma ainda'"): havia um
            `<Feather name="chevron-right">` aqui que o web NÃO tem. O
            estado vazio do web (`ProfileRecommendationsPreview.tsx`)
            termina no texto — o card inteiro já é o alvo do toque, a
            seta era invenção do mobile.
          */}
        </Glass>
      </Pressable>
    );
  }

  const latest = recommendations[0]!;
  const uniqueSenderIds = [...new Set(recommendations.map((r) => r.sender.userId))];
  const uniqueSenders = [...new Map(recommendations.map((r) => [r.sender.userId, r.sender])).values()].slice(0, 4);
  const posterUrl = tmdbImageUrl(latest.posterPath, "w185");
  const unreadCount = recommendations.filter((r) => !r.readAt).length;
  const extraCount = recommendations.length - 1;
  const senderName = latest.sender.displayName ?? latest.sender.username;

  let message: React.ReactNode;
  if (extraCount === 0) {
    message = fraseComNomeEmNegrito(t("profile.recommendedSingle"), senderName, { title: latest.title });
  } else if (uniqueSenderIds.length === 1) {
    message = fraseComNomeEmNegrito(t("profile.recommendedPlusTitles"), senderName, {
      title: latest.title,
      count: extraCount,
      noun: extraCount === 1 ? t("profile.titleSingular") : t("profile.titlePlural"),
    });
  } else {
    const others = uniqueSenderIds.length - 1;
    message = fraseComNomeEmNegrito(t("profile.recommendedByMultiplePeople"), senderName, {
      count: others,
      noun: others === 1 ? t("profile.personSingular") : t("profile.personPlural"),
    });
  }

  return (
    <Pressable onPress={() => router.push("/profile/recommendations")}>
      <Glass style={[styles.card, unreadCount > 0 && styles.cardHighlighted]}>
        <View style={styles.avatarStack}>
          <View style={styles.avatarRow}>
            {uniqueSenders.map((sender, index) => (
              <Avatar
                key={sender.userId}
                uri={sender.avatarUrl}
                name={sender.displayName ?? sender.username}
                fallbackText={(sender.displayName ?? sender.username).slice(0, 1).toUpperCase()}
                /* CORREÇÃO (2026-09-03, comparado com o web) — era -10; o web usa `-space-x-3` (`ProfileRecommendationsPreview.tsx`, avatares sobrepostos) = -12px. */
                style={[styles.avatar, { marginLeft: index === 0 ? 0 : -12, zIndex: uniqueSenders.length - index }]}
                textStyle={styles.avatarInitial}
              />
            ))}
          </View>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </View>

        <Text numberOfLines={2} style={styles.message}>
          {message}
        </Text>

        {posterUrl && (
          <View style={styles.poster}>
            <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
          </View>
        )}
      </Glass>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  /**
   * CORREÇÃO (2026-09-03, comparado com o web) — `gap: spacing.sm`
   * (8); o web usa `gap-3` (`ProfileRecommendationsPreview.tsx`,
   * card) = 12px — sem token exato, valor literal.
   * `paddingVertical: spacing.sm + 4` (12) também estava errado — o
   * web usa `py-3.5` = 14px.
   */
  // CORREÇÃO (2026-09-03, decisão do usuário: padronizar borda de tela
  // em 16px app-wide) — `marginHorizontal` era `spacing.lg` (24); web
  // usa `px-4` (`spacing.md`=16) como borda de tela. `marginBottom`
  // (ritmo vertical) NÃO foi tocado — fora do escopo.
  /**
   * CORREÇÃO (2026-09-04, comparado com `ProfileRecommendationsPreview.tsx`
   * do web, a pedido — "card de recomendações está diferente"):
   * - `borderRadius` era `radius.md` (10); o web usa `rounded-2xl` = 16
   *   (`radius.lg`). Era a diferença mais visível — canto quase reto
   *   contra canto bem arredondado.
   * - `marginBottom` era `spacing.lg` (24); o web usa `mb-2` = 8. O
   *   card estava com 3× o respiro de baixo que tem lá, empurrando
   *   tudo que vem depois.
   */
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  /**
   * Destaque de "tem recomendação não lida". O web usa três coisas
   * juntas (`border-primary/60 bg-primary/5 ring-1 ring-primary/20`) e
   * o mobile só tinha a borda, numa opacidade menor (`tint.border` =
   * 0.4, contra 0.6 do web) — por isso o destaque quase não aparecia.
   * O `ring-1` vira `outlineWidth`/`outlineColor` (RN tem isso desde a
   * New Architecture, que este app já usa) — é o equivalente exato:
   * um traço 1px POR FORA da borda, sem alterar o tamanho da caixa.
   */
  cardHighlighted: {
    borderColor: "rgba(232,163,61,0.6)",
    backgroundColor: "rgba(232,163,61,0.05)",
    outlineWidth: 1,
    outlineColor: "rgba(232,163,61,0.2)",
  },
  /**
   * CORREÇÃO (2026-09-04, medido nos dois prints a pedido — "tem um
   * circulo transparente amarelo, no icone do card de recomendações,
   * web não é assim"): o `backgroundColor: tint.subtle` (âmbar 12%)
   * saiu.
   *
   * CAUSA RAIZ (não foi escolha de gosto): a marcação do web TEM a
   * classe `bg-primary/12` nesse mesmo lugar, então a leitura do
   * código sozinha diria que o disco existe lá. Medindo o PIXEL do
   * print do web em quatro raios a partir do centro do ícone (11, 13,
   * 16 e 20px), a cor é CONSTANTE `#2E445D` — ou seja, no web esse
   * disco não chega a ser pintado. No mobile o mesmo teste ia de
   * `#3E403F` (centro) a `#25313F` (borda): disco visível. Portanto o
   * que reproduz o web aqui é NÃO pintar o fundo.
   *
   * A caixa 32×32 continua — ela é o que alinha o ícone com o texto.
   */
  emptyIcon: {
    height: 32,
    width: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: "500",
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-15) — negrito do nome dentro da frase de recomendação; web `font-semibold` = 600 (ver `fraseComNomeEmNegrito` acima). */
  messageSenderName: {
    fontWeight: "600",
    color: colors.text,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — era `fontSize.sm` (14); o web usa `text-xs` (`ProfileRecommendationsPreview.tsx`, "profile.noneYet") = 12px. */
  emptyLabel: {
    fontSize: fontSize.xs,
  },
  avatarStack: {
    position: "relative",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    height: AVATAR_SIZE,
    width: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitial: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted,
  },
  /** CORREÇÃO (2026-09-03, comparado com o web) — `paddingHorizontal: 3`; o web usa `px-1` (`ProfileRecommendationsPreview.tsx`, selo de não lidas) = 4px. Resto (h-4/min-w-4/rounded-full/border-2 = 16/16/full/2) já batia. */
  unreadBadge: {
    position: "absolute",
    right: -4,
    top: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.background,
    lineHeight: 11,
  },
  message: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  poster: {
    width: 40,
    height: 56,
    borderRadius: radius.sm,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
});
