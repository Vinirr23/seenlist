import { useEffect, useState } from "react";
import { Modal, View, Pressable, StyleSheet } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { Text } from "@/components/ui";
import { WhatsNewIcon } from "@/components/whats-new/WhatsNewIcon";
import { fetchWhatsNewEntries, fetchWhatsNewUnseen, markWhatsNewSeen, type WhatsNewEntry } from "@/lib/whatsNew";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { colors, radius, spacing, fontSize, fontFamily } from "@/lib/theme";

/**
 * NOVO (2026-10-07) — "Novidades", opção A do mockup aprovado
 * (`https://claude.ai/artifact/3BdDGCGUffH4fygEYVdm7f`, artboard
 * `ModalCelebratorio.dc.html`): modal comemorativo que aparece sozinho
 * ao abrir o app, enquanto houver novidade não vista — "Entendi" marca
 * como visto e fecha pra sempre (até a próxima novidade cadastrada).
 *
 * Montado uma vez no layout raiz (`app/_layout.tsx`), igual a
 * `AnimatedSplash` — precisa existir em toda tela, não só dentro de
 * `(tabs)`. Só checa/mostra depois que a sessão resolve (`session` não
 * nulo) e fora de `(auth)` — sem isso, o modal podia tentar aparecer
 * por cima da tela de login, antes de saber se há alguém logado.
 */
export function WhatsNewModal() {
  const { session } = useAuth();
  const segmentos = useSegments();
  const router = useRouter();
  const { t } = useTranslation();
  const [entries, setEntries] = useState<WhatsNewEntry[] | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session?.user.id || segmentos[0] === "(auth)") return;
    let cancelled = false;
    fetchWhatsNewUnseen().then((unseen) => {
      if (cancelled || !unseen) return;
      fetchWhatsNewEntries().then((data) => {
        if (cancelled || data.length === 0) return;
        setEntries(data);
        setVisible(true);
      });
    });
    return () => {
      cancelled = true;
    };
    // Checa só uma vez por sessão do app (equivalente a "ao abrir o
    // app"), não a cada troca de rota — por isso `segmentos` não entra
    // nas dependências, só é lido na hora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id]);

  function handleDismiss() {
    setVisible(false);
    markWhatsNewSeen();
  }

  function handleSeeAll() {
    setVisible(false);
    markWhatsNewSeen();
    router.push("/whats-new");
  }

  if (!entries) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <Pressable style={styles.overlay} onPress={handleDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.emoji}>✨</Text>
            <Text style={styles.title}>{t("whatsNew.modalTitle")}</Text>
            <Text variant="muted" style={styles.subtitle}>
              {t("whatsNew.modalSubtitle")}
            </Text>
          </View>

          <View style={styles.list}>
            {entries.map((entry) => (
              <View key={entry.id} style={styles.row}>
                <WhatsNewIcon iconKey={entry.iconKey} size={19} chipSize={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{entry.title}</Text>
                  <Text variant="muted" style={styles.rowDescription}>
                    {entry.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable style={styles.seeAllButton} onPress={handleSeeAll}>
            <Text style={styles.seeAllButtonText}>{t("whatsNew.seeAll")}</Text>
          </Pressable>
          <Pressable style={styles.gotItButton} onPress={handleDismiss}>
            <Text style={styles.gotItButtonText}>{t("whatsNew.gotIt")}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(5,7,11,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
  },
  emoji: { fontSize: 26 },
  title: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily[800],
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.xs,
    textAlign: "center",
  },
  list: { gap: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  rowTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily[700],
    color: colors.text,
  },
  rowDescription: {
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.35,
  },
  seeAllButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 5,
    alignItems: "center",
  },
  seeAllButtonText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily[700],
    color: colors.muted,
  },
  gotItButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 5,
    alignItems: "center",
  },
  gotItButtonText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily[700],
    color: colors.background,
  },
});
