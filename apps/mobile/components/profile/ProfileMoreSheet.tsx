import { Modal, Pressable, Share, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing, scrim, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO (2026-09-15 — "do lado direito, implementa um botão (...)
 * e nele um sheet com 'editar, compartilhar, configurações e ajuda'
 * (editar, compartilhar, configurações são os que já existem e vão
 * ficar dentro desse sheet)") — os 3 primeiros eram ícones soltos em
 * `app/(tabs)/profile.tsx` (lápis + compartilhar + engrenagem, um do
 * lado do outro, sobre a capa) mais o botão "Editar" de baixo (caso
 * sem capa); viraram linhas de UM sheet só, atrás do "...". "Ajuda" é
 * item novo — aponta pra `/settings/feedback`, o único canal de
 * suporte que já existe no app.
 *
 * Mesmo formato de sheet do `SeriesQuickActionsSheet.tsx` (Modal +
 * `Glass` variant `dark` deslizando de baixo, linhas ícone+texto).
 *
 * REMOVIDO (2026-09-16, a pedido — "remove 'editar' do sheet (...)",
 * mesma mudança feita no web) — o item "Editar" (rota
 * `/settings/edit-profile`) saiu daqui porque virou um botão direto
 * no cabeçalho (ver `app/(tabs)/profile.tsx`, no lugar de onde ficava
 * o "@username").
 */
export function ProfileMoreSheet({ username, onClose }: { username?: string | null; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  async function handleShare() {
    if (!username) {
      onClose();
      return;
    }
    try {
      await Share.share({ message: `https://seenlist.app/u/${username}` });
    } catch (error) {
      console.error("[ProfileMoreSheet] Falha ao compartilhar", error);
    }
    onClose();
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Glass style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} variant="dark">
            {/*
              * REMOVIDO (2026-09-24, a pedido — "remove 'sua semana' do
              * app, que ainda está aparecendo o sheet") — o botão
              * temporário pro Week Review (`app/week-review.tsx`,
              * adicionado na rodada 26) saiu daqui. A feature foi
              * PAUSADA: o card de Compartilhar mostrou um caso real
              * (atividade espalhada por 8 séries, 1 episódio cada) onde
              * o "recorde pessoal" fica sem sentido ("1" ao lado de "8"
              * no card de stats) — o usuário está avaliando uma
              * reformulação maior (ranking "Seus favoritos" e/ou trocar
              * a granularidade de semanal pra mensal) antes de expor a
              * tela de novo. `app/week-review.tsx` e toda a
              * infraestrutura de servidor (pré-geração, notificação,
              * cron) continuam existindo no código, só sem nenhum ponto
              * de entrada na UI por enquanto.
              */}
            <ActionRow icon="share-2" label={t("social.share")} onPress={handleShare} />
            <ActionRow
              icon="settings"
              label={t("settings.title")}
              onPress={() => {
                onClose();
                router.push("/settings");
              }}
            />
            <ActionRow
              icon="help-circle"
              label={t("profile.help")}
              onPress={() => {
                onClose();
                router.push("/settings/feedback");
              }}
            />

            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Feather name="x" size={16} color={colors.muted} />
              <Text variant="muted">{t("common.cancel")}</Text>
            </Pressable>
          </Glass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ActionRow({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <Feather name={icon} size={16} color={colors.text} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: scrim.modal,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  // FASE 2 (consistência visual sistêmica, 2026-09-26) — token formalizado `fontSize.sm` (era literal 14, mesmo valor).
  actionLabel: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  cancelButton: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
  },
});
