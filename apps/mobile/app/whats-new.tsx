import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { Screen, Text, Skeleton, GlassTargetProvider, AmbientGlow, Glass, ScreenHeader } from "@/components/ui";
import { WhatsNewIcon } from "@/components/whats-new/WhatsNewIcon";
import { fetchWhatsNewEntries, markWhatsNewSeen, type WhatsNewEntry } from "@/lib/whatsNew";
import { SUBPAGE_GLOW_BLOBS } from "@/lib/glowBlobs";
import { colors, radius, spacing, fontSize, fontFamily } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { useTabBarClearance } from "@/lib/useTabBarClearance";

/**
 * NOVO (2026-10-07) — "Novidades", opção B do mockup aprovado
 * (`https://claude.ai/artifact/3BdDGCGUffH4fygEYVdm7f`, artboard
 * `TelaChangelog.dc.html`): tela permanente, acessível a qualquer hora
 * (decisão do usuário — card fixo dentro do sino, ver
 * `app/notifications.tsx`), diferente do modal comemorativo (A, só
 * aparece uma vez por novidade). Mesma estrutura de sub-tela de
 * `app/notifications.tsx` (Screen + ScreenHeader + GlassTargetProvider
 * + AmbientGlow com o mesmo conjunto de manchas das demais sub-telas).
 *
 * SIMPLIFICAÇÃO v1 (deliberada): o mockup agrupava por data ("Essa
 * semana" / "Setembro") — aqui é uma lista única, mais recente
 * primeiro. Sem usuários o suficiente ainda gerando entradas pra o
 * agrupamento importar; fácil de acrescentar depois se a lista crescer
 * e isso passar a fazer diferença de verdade.
 */
export default function WhatsNewScreen() {
  const espacoDoDock = useTabBarClearance();
  const { t, locale } = useTranslation();
  const dateFormatter = useCallback(
    (iso: string) => new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: "2-digit", month: "long" }).format(new Date(iso)),
    [locale]
  );
  const [entries, setEntries] = useState<WhatsNewEntry[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchWhatsNewEntries().then(setEntries);
      // Marca como visto ao ABRIR a tela, não ao sair — é aqui que a
      // pessoa efetivamente viu o conteúdo (mesmo raciocínio do modal
      // comemorativo: a bolinha do sino deve sumir assim que a tela é
      // vista, não só se a pessoa rolar até o fim).
      markWhatsNewSeen();
    }, [])
  );

  return (
    <Screen padded={false}>
      <ScreenHeader title={t("whatsNew.title")} />
      <GlassTargetProvider style={styles.glassFill} background={<AmbientGlow blobs={SUBPAGE_GLOW_BLOBS} />}>
        {entries === null ? (
          <View style={[styles.content, { gap: spacing.sm }]}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.card}>
                <Skeleton width={36} height={36} borderRadius={radius.sm} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="90%" height={12} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={entries}
            keyExtractor={(entry) => entry.id}
            contentContainerStyle={[styles.content, { paddingBottom: espacoDoDock }]}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text variant="muted" style={styles.emptyStateText}>
                  {t("whatsNew.empty")}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <Glass style={styles.card}>
                <WhatsNewIcon iconKey={item.iconKey} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.entryTitle}>{item.title}</Text>
                  <Text variant="muted" style={styles.entryDescription}>
                    {item.description}
                  </Text>
                  <Text variant="muted" style={styles.entryDate}>
                    {dateFormatter(item.createdAt)}
                  </Text>
                </View>
              </Glass>
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          />
        )}
      </GlassTargetProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glassFill: { flex: 1 },
  content: { padding: spacing.md },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  entryTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily[700],
    color: colors.text,
  },
  entryDescription: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.4,
  },
  entryDate: {
    fontSize: fontSize.micro,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 64,
  },
  emptyStateText: {
    textAlign: "center",
  },
});
