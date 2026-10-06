import { useState } from "react";
import { View, Modal, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUserSearch } from "@/lib/useUserSearch";
import { inviteCoOwner } from "@/lib/lists";
import { hapticTick, hapticSuccess } from "@/lib/haptics";
import { Text, Skeleton, Glass } from "@/components/ui";
import { VerifiedBadge } from "@/components/common/VerifiedBadge";
import { colors, radius, spacing, tint, scrim, fontSize } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * LISTA COMPARTILHADA (2026-10-06) — convite de co-dono pra "Minhas
 * listas". Porte quase 1:1 de `RecommendSheet.tsx` (mesma estrutura de
 * folha: busca + lista radio + botão de enviar), trocando
 * `fetchFollowList` (só quem eu sigo) por `useUserSearch`/
 * `fetchUserSearch` (busca por username entre QUALQUER pessoa — decisão
 * confirmada: convite é por busca de username, não restrito a quem já
 * se segue, já que a dupla pode não se seguir no app).
 */
export function InviteCoOwnerSheet({
  listId,
  listName,
  onClose,
  onInvited,
}: {
  listId: string;
  listName: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { users, isLoading } = useUserSearch(search);

  async function handleSend() {
    if (!selectedUserId) return;
    hapticTick();
    setSending(true);
    setErrorMessage(null);
    try {
      await inviteCoOwner(listId, listName, selectedUserId);
      hapticSuccess();
      onInvited();
      onClose();
    } catch (error) {
      console.error("[InviteCoOwnerSheet] Falha ao convidar co-dono", error);
      const isConflict = error instanceof Error && error.message.includes("convite ativo");
      setErrorMessage(isConflict ? t("error.listAlreadyHasCoOwner") : t("error.inviteCoOwnerFailed"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Glass style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} variant="dark">
          <View style={styles.header}>
            <Text numberOfLines={1} style={styles.title}>
              {t("profile.inviteCoOwner")}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("profile.searchUsernameToInvite")}
            placeholderTextColor={colors.muted}
            autoFocus
            style={styles.searchInput}
          />

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <View style={styles.listWrapper}>
            {isLoading && users === null && (
              <View style={{ gap: spacing.xs }}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.personRow}>
                    <Skeleton width={36} height={36} borderRadius={18} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Skeleton width="50%" height={13} />
                      <Skeleton width="35%" height={11} />
                    </View>
                  </View>
                ))}
              </View>
            )}
            {users && users.length === 0 && (
              <Text variant="muted" style={styles.emptyText}>
                {t("profile.noUserFoundToInvite")}
              </Text>
            )}
            <FlatList
              data={users ?? []}
              keyExtractor={(item) => item.userId}
              style={{ maxHeight: 260 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = selectedUserId === item.userId;
                return (
                  <Pressable
                    style={[styles.personRow, selected && styles.personRowSelected]}
                    onPress={() => setSelectedUserId(selected ? null : item.userId)}
                  >
                    <View style={styles.avatar}>
                      {item.avatarUrl && <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text numberOfLines={1} style={styles.personName}>
                          {item.displayName ?? item.username}
                        </Text>
                        <VerifiedBadge tier={item.verifiedTier} size={13} />
                      </View>
                      <Text numberOfLines={1} variant="muted" style={styles.personUsername}>
                        @{item.username}
                      </Text>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]} />
                  </Pressable>
                );
              }}
            />
          </View>

          <Pressable
            style={[styles.sendButton, (!selectedUserId || sending) && styles.sendButtonDisabled]}
            disabled={!selectedUserId || sending}
            onPress={handleSend}
          >
            <Feather name="send" size={16} color={colors.background} />
            <Text style={styles.sendButtonText}>{sending ? t("common.sending") : t("profile.sendInvite")}</Text>
          </Pressable>
        </Glass>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: scrim.modal },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, flex: 1, marginRight: spacing.sm },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: fontSize.xs, marginBottom: spacing.sm },
  listWrapper: { marginBottom: spacing.sm },
  emptyText: { textAlign: "center", paddingVertical: spacing.md },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  personRowSelected: { backgroundColor: tint.subtle },
  nameRow: { flexDirection: "row", alignItems: "center", minWidth: 0 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  personName: { fontSize: fontSize.sm, fontWeight: "500", color: colors.text, flexShrink: 1 },
  personUsername: { fontSize: fontSize.xs },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: colors.background, fontWeight: "700", fontSize: fontSize.sm },
});
