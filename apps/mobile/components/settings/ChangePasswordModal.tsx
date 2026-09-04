import { useState } from "react";
import { View, Modal, TextInput, Pressable, StyleSheet } from "react-native";
import { updatePassword } from "@/lib/settings";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    const result = await updatePassword(password, confirmPassword);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {t("settings.changePassword")}
          </Text>

          {/*
            * CORREÇÃO (auditoria consistência web/mobile — `TextPromptDialog.tsx`
            * do web) — cada campo tinha só um placeholder cinza que
            * sumia ao digitar, sem rótulo fixo nenhum acima; o web
            * mostra um `<label>` fixo (`text-xs text-muted`) por cima
            * de cada campo, que fica visível o tempo todo. Rótulo
            * novo abaixo usa a MESMA tradução que já existia como
            * placeholder — só mudou de posição/comportamento.
            */}
          <View style={styles.form}>
            <View>
              <Text style={styles.fieldLabel}>{t("auth.newPassword")}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.input}
              />
            </View>
            <View>
              <Text style={styles.fieldLabel}>{t("auth.confirmNewPassword")}</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={styles.input}
              />
            </View>
            {!!error && <Text style={styles.errorText}>{error}</Text>}
          </View>

          <View style={styles.buttons}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>{t("common.cancel")}</Text>
            </Pressable>
            <View style={styles.saveButton}>
              <Button onPress={handleSubmit} loading={saving}>
                {t("common.save")}
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (auditoria consistência web/mobile — `TextPromptDialog.tsx`
  // do web) — `padding` do overlay era 32 (`spacing.xl`); web usa
  // `px-4`=16 no container fixo do diálogo.
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: scrim.modal,
    padding: spacing.md,
  },
  // CORREÇÃO — `padding` do card era 16 (`spacing.md`); web usa `p-5`=20.
  // O `gap` uniforme (16) saiu — web tem 3 espaçamentos DIFERENTES
  // (título→campos 16, entre campos 12, campos→botões 20), tratados
  // agora item a item (`title.marginBottom`, `form.gap`,
  // `buttons.marginTop`) em vez de um valor só pra tudo.
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
  },
  // CORREÇÃO — usava `variant="subtitle"` (18/600); web: `text-base
  // font-semibold`=16/600.
  title: {
    textAlign: "center",
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.text,
    marginBottom: spacing.md,
  },
  // CORREÇÃO — `gap` era 8 (`spacing.sm`); web usa `space-y-3`=12 entre
  // campos (e a msg de erro, dentro do mesmo bloco, tem `mt-3`=12
  // também — mesmo valor, por isso continua no mesmo `gap`).
  form: {
    gap: 12,
  },
  // CORREÇÃO — rótulo fixo novo (não existia — só havia placeholder),
  // mesmo padrão do `<label>` do web: `text-xs text-muted mb-1`.
  fieldLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  // CORREÇÃO — `borderRadius` era 10 (`radius.md`); web usa
  // `rounded-lg`=8. `paddingHorizontal` era 8 (`spacing.sm`); web usa
  // `px-3`=12. `paddingVertical` (8) já batia com `py-2`=8, mantido.
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  // CORREÇÃO — web: `text-xs` (12) na mensagem de erro, não
  // `text-sm`/14 com peso 500 (`variant="error"` do `Text` local).
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: "400",
    color: colors.danger,
  },
  // CORREÇÃO — não tinha `marginTop`; web usa `mt-5`=20 entre os
  // campos/erro e a linha de botões (o `gap-2`=8 entre os dois
  // botões já batia com `spacing.sm`, sem mudança).
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 20,
  },
  // CORREÇÃO — botão "Cancelar" no web é do MESMO tamanho/formato do
  // botão "Salvar" ao lado (`flex-1`, borda, `rounded-lg`=8,
  // `py-2.5`=10, texto `text-sm text-text` — não `text-muted`); aqui
  // era só texto sem borda, sem `flex-1` (ficava menor que "Salvar",
  // colado à esquerda) e cinza (`variant="muted"`).
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: fontSize.sm,
    color: colors.text,
  },
  saveButton: {
    flex: 1,
  },
});
