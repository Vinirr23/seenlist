import { useEffect, useState } from "react";
import { View, Modal, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, Keyboard, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fetchFollowList, type FollowListUser } from "@/lib/followList";
import { sendRecommendation } from "@/lib/recommendations";
import { hapticTick, hapticSuccess } from "@/lib/haptics";
import { Text, Skeleton } from "@/components/ui";
import { colors, radius, spacing, tint, scrim } from "@/lib/theme";

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
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState<FollowListUser[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  /**
   * CORREÇÃO (bug real, reportado com print — "o teclado apareceu em
   * cima de onde eu estava escrevendo") — a lista de pessoas tem
   * altura FIXA (260). Com o teclado aberto, o `behavior="height"`
   * encolhe o espaço disponível da folha, mas essa lista continuava
   * ocupando os mesmos 260, empurrando o campo de mensagem (e o
   * botão de enviar) pra fora da área visível. Encolher a lista
   * enquanto o teclado está aberto resolve sem precisar aninhar
   * rolagem dentro de rolagem (`FlatList` dentro de `ScrollView` é
   * um padrão com bug conhecido no React Native, evitado de
   * propósito aqui).
   */
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
    hapticTick();
    setSending(true);
    try {
      await sendRecommendation(selectedUserId, mediaType, mediaId, message);
      // A PEDIDO (feedback háptico) — mesma lógica de publicar post:
      // é o fim de um fluxo, não uma ação avulsa.
      hapticSuccess();
      onClose();
    } catch (error) {
      console.error("[RecommendSheet] Falha ao enviar recomendação", error);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* TASK-176 (mesma correção de MovieQuickActionsSheet.tsx/SeriesQuickActionsSheet.tsx) — KeyboardAvoidingView filho direto do Modal, "tocar fora fecha" virou Pressable de fundo separado. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
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
            {following === null && (
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
            {following && following.length === 0 && (
              <Text variant="muted" style={styles.emptyText}>
                {search.trim() ? "Ninguém encontrado." : "Você ainda não segue ninguém."}
              </Text>
            )}
            <FlatList
              data={following ?? []}
              keyExtractor={(item) => item.userId}
              style={{ maxHeight: keyboardOpen ? 120 : 260 }}
              keyboardShouldPersistTaps="handled"
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: scrim.modal },
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
  personRowSelected: { backgroundColor: tint.subtle },
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
