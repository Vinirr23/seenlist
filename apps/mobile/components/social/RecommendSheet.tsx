import { useEffect, useState } from "react";
import { View, Modal, Pressable, TextInput, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchFollowList, type FollowListUser } from "@/lib/followList";
import { sendRecommendation } from "@/lib/recommendations";
import { Text } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";

const MAX_MESSAGE_LENGTH = 200;

/**
 * TASK-169 — porta de `RecommendSheet.tsx` do web. Reaproveita
 * `fetchFollowList` (já existia pra Seguidores/Seguindo) — só pra
 * quem o usuário segue, mesma regra do web.
 */
export function RecommendSheet({
  mediaType,
  mediaId,
  mediaTitle,
  onClose,
}: {
  mediaType: "movie" | "series";
  mediaId: number;
  mediaTitle: string;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState<FollowListUser[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    let cancelled = false;
    fetchFollowList(userId, "following", search).then((list) => {
      if (!cancelled) setFollowing(list);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, search]);

  async function handleSend() {
    if (!selectedUserId) return;
    setSending(true);
    try {
      await sendRecommendation(selectedUserId, mediaType, mediaId, message);
      onClose();
    } catch (error) {
      console.error("[RecommendSheet] Falha ao enviar recomendação", error);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text numberOfLines={1} style={styles.title}>
              Recomendar &quot;{mediaTitle}&quot;
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={20} color={colors.muted} />
            </Pressable>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar entre quem você segue..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />

          <View style={styles.listWrapper}>
            {following === null && <Text variant="muted" style={styles.emptyText}>Carregando...</Text>}
            {following && following.length === 0 && (
              <Text variant="muted" style={styles.emptyText}>
                {search.trim() ? "Ninguém encontrado." : "Você ainda não segue ninguém."}
              </Text>
            )}
            <FlatList
              data={following ?? []}
              keyExtractor={(item) => item.userId}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => {
                const selected = selectedUserId === item.userId;
                return (
                  <Pressable
                    style={[styles.personRow, selected && styles.personRowSelected]}
                    onPress={() => {
                      setSelectedUserId(selected ? null : item.userId);
                    }}
                  >
                    <View style={styles.avatar}>
                      {item.avatarUrl && <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={styles.personName}>
                        {item.displayName ?? item.username}
                      </Text>
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

          <TextInput
            value={message}
            onChangeText={(text) => setMessage(text.slice(0, MAX_MESSAGE_LENGTH))}
            placeholder="Escreva uma mensagem (opcional)"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.messageInput}
          />

          <Pressable
            style={[styles.sendButton, (!selectedUserId || sending) && styles.sendButtonDisabled]}
            disabled={!selectedUserId || sending}
            onPress={handleSend}
          >
            <Feather name="send" size={16} color={colors.background} />
            <Text style={styles.sendButtonText}>{sending ? "Enviando..." : "Enviar recomendação"}</Text>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  keyboardView: { justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1, marginRight: spacing.sm },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.sm,
  },
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
  personRowSelected: { backgroundColor: "rgba(232,163,61,0.1)" },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  personName: { fontSize: 14, fontWeight: "500", color: colors.text },
  personUsername: { fontSize: 12 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  messageInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: spacing.sm,
  },
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
  sendButtonText: { color: colors.background, fontWeight: "700", fontSize: 14 },
});
