import { useState } from "react";
import { View, Modal, TextInput, Pressable, StyleSheet } from "react-native";
import { updatePassword } from "@/lib/settings";
import { Text, Button } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
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
          <Text variant="subtitle" style={styles.title}>
            Alterar senha
          </Text>

          <View style={styles.form}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Nova senha"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirmar nova senha"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />
            {!!error && <Text variant="error">{error}</Text>}
          </View>

          <View style={styles.buttons}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text variant="muted">Cancelar</Text>
            </Pressable>
            <View style={styles.saveButton}>
              <Button onPress={handleSubmit} loading={saving}>
                Salvar
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  title: {
    textAlign: "center",
  },
  form: {
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  saveButton: {
    flex: 1,
  },
});
