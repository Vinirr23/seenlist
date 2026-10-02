import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { FriendsWatchingItem } from "@/lib/trending";
import { tmdbImageUrl } from "@/lib/library";
import { Text, PressableScale } from "@/components/ui";
import { Avatar } from "@/components/common/Avatar";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

// Mesmo padrão de `FeedTrendingModule.tsx` — até 3 colunas lado a
// lado (`lib/trending.ts` já limita a busca a 3 séries).
const DISPLAY_LIMIT = 3;
// AUMENTADO (2026-10-01, feedback de design — "aumentaria um pouco.
// Hoje estão pequenos demais e são justamente o elemento que comunica
// 'friends'") — era 20.
const AVATAR_SIZE = 24;
const AVATAR_OVERLAP = 8;

/**
 * "SEUS AMIGOS ESTÃO ASSISTINDO" (2026-10-01, documento de UX —
 * REDESENHADO duas vezes no mesmo dia por feedback de design):
 *
 * 1ª rodada — "espaço demais pra pouca informação" no card único/largo
 * original: virou 3 colunas lado a lado, mesma receita visual do
 * `FeedTrendingModule` ("em alta").
 *
 * 2ª rodada (este comentário) — ajustes de polimento sobre as 3
 * colunas, todos a pedido explícito:
 *   - Avatares maiores (`AVATAR_SIZE` acima) e agora SOBREPONDO a
 *     parte inferior do pôster (`avatarStack` com posição absoluta,
 *     metade sobre a imagem/metade pra fora — "conecta visualmente
 *     pessoa → obra e economiza altura"), em vez de ficar numa faixa
 *     própria embaixo do pôster.
 *   - Espaçamento entre pôster/avatares/título reduzido, pra cada
 *     conjunto (pôster+avatares+nome) parecer uma unidade só.
 *   - Nome da série com mais contraste (`colors.text` em vez de
 *     `colors.muted`, peso 600).
 *   - Ícone do cabeçalho voltou a ser `Feather` (não mais o emoji 👥
 *     da rodada anterior) — pedido explícito: "ícone azul [o emoji]
 *     está chamando atenção demais (...) usaria a mesma linguagem
 *     visual do SeenList — ícone discreto em âmbar". NOTA: a mesma
 *     observação pode valer pro 🔥 do `FeedTrendingModule` (ele não
 *     apareceu no print revisado desta vez) — não mexi lá sem
 *     confirmar, ver aviso na resposta.
 *   - NOVO: contador "+N" ao lado dos avatares quando há mais
 *     seguidos assistindo do que cabe no empilhado visível
 *     (`item.totalCount` já vinha de `lib/trending.ts`, só não era
 *     usado na UI até agora). Só o número, sem toque funcional ainda
 *     (pedido foi "pode abrir quem está assistindo" — condicional,
 *     não implementado nesta rodada; ver aviso na resposta).
 *
 * Só na aba "Seguindo" (ver `lib/useFeedEntries.ts`), só série (ver
 * `lib/trending.ts`). Sem rating/progresso/episódios de propósito —
 * pedido explícito: a função do módulo é só responder "o que as
 * pessoas que eu sigo estão vendo".
 */
export function FeedFriendsWatchingModule({ items }: { items: FriendsWatchingItem[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const visible = items.slice(0, DISPLAY_LIMIT);

  if (visible.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Feather name="users" size={13} color={colors.primary} />
        <Text style={styles.title}>{t("feed.friendsWatchingTitle")}</Text>
      </View>
      <View style={styles.row}>
        {visible.map((item) => {
          const posterUrl = item.mediaPosterPath ? tmdbImageUrl(item.mediaPosterPath, "w185") : null;
          const extraCount = item.totalCount - item.watchers.length;
          return (
            // FEEDBACK DE TOQUE (2026-10-01, a pedido — achado da
            // auditoria UI/UX) — `PressableScale` em vez de `Pressable`
            // puro; `alignItems` de `item` migrou pra `itemInner` pelo
            // mesmo motivo de `FeedTrendingModule.tsx` (o `Animated.View`
            // interno do `PressableScale` só recebe `flex: 1`).
            <PressableScale key={item.mediaId} style={styles.item} onPress={() => router.push(`/series/${item.mediaId}`)}>
              <View style={styles.itemInner}>
                <View style={styles.posterWrap}>
                  <View style={styles.poster}>
                    {posterUrl ? (
                      <Image source={{ uri: posterUrl }} style={styles.posterImage} contentFit="cover" />
                    ) : (
                      <Feather name="film" size={18} color={colors.muted} />
                    )}
                  </View>
                  <View style={styles.avatarStack}>
                    {item.watchers.map((watcher, i) => (
                      <Avatar
                        key={watcher.userId}
                        uri={watcher.avatarUrl}
                        name={watcher.name}
                        style={[styles.avatar, i > 0 && { marginLeft: -AVATAR_OVERLAP }]}
                        textStyle={styles.avatarInitials}
                      />
                    ))}
                    {extraCount > 0 && <Text style={styles.moreCount}>+{extraCount}</Text>}
                  </View>
                </View>
                <Text numberOfLines={1} style={styles.mediaTitle}>
                  {item.mediaTitle}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  // Sem `gap` aqui (2026-10-01, feedback de design — "aproximaria
  // tudo... pra cada conjunto parecer uma unidade") — o espaçamento
  // entre pôster/avatares/nome agora é controlado por `posterWrap`
  // (reserva só o tanto necessário pro avatar sobreposto) + a margem
  // pequena do próprio `mediaTitle`, em vez de um `gap` uniforme.
  item: {
    flex: 1,
  },
  // Ver comentário de `PressableScale`, acima — mesmo `alignItems` que `item` tinha antes, só movido pra dentro do `Animated.View` real.
  itemInner: {
    flex: 1,
    alignItems: "center",
  },
  // `overflow: "visible"` de propósito — é o que deixa `avatarStack`
  // (abaixo) sobrepor a borda inferior do pôster sem ser cortado.
  posterWrap: {
    width: "100%",
    position: "relative",
    overflow: "visible",
  },
  poster: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  // Posição absoluta (2026-10-01, feedback de design — "testaria
  // sobrepor parcialmente a parte inferior do poster. Isso conecta
  // visualmente pessoa → obra e economiza altura") — metade da altura
  // do avatar fica sobre a imagem, metade pra fora dela (`bottom:
  // -AVATAR_SIZE / 2`), em vez de ocupar uma faixa própria abaixo do
  // pôster como antes.
  avatarStack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -AVATAR_SIZE / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.background,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarInitials: {
    fontSize: fontSize.micro,
    fontWeight: "700",
    color: colors.muted,
  },
  // NOVO (2026-10-01, a pedido — "●● +2" em vez de só os avatares
  // visíveis, quando há mais seguidos assistindo do que cabe no
  // empilhado) — `item.totalCount` já existia em `lib/trending.ts`
  // (contagem de TODOS os seguidos assistindo aquela série, antes de
  // cortar pro limite de avatares visíveis), só não era usado na UI.
  moreCount: {
    marginLeft: 4,
    fontSize: fontSize.micro,
    fontWeight: "700",
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.background,
    paddingHorizontal: 4,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  // Contraste aumentado (2026-10-01, feedback de design — "está
  // pequeno e com contraste baixo") — era `colors.muted`, sem peso.
  // Espaço reservado em cima pra metade do avatar que fica pendurada
  // fora do pôster (`AVATAR_SIZE / 2`) não encostar no texto.
  mediaTitle: {
    marginTop: AVATAR_SIZE / 2 + 4,
    fontSize: fontSize.xxs,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
});
