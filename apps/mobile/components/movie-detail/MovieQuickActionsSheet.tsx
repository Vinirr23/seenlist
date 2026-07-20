import { useState } from "react";
import { View, Modal, Pressable, TextInput, ScrollView, Share, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useMyLists } from "@/lib/useMyLists";
import { addToList } from "@/lib/lists";
import { removeMovieFromLibrary } from "@/lib/movieDetails";
import { Text, Skeleton } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import { RecommendSheet } from "../social/RecommendSheet";

export interface MovieQuickActionsSheetProps {
  movieId: number;
  movieTitle: string;
  onRemoved: () => void;
  onClose: () => void;
}

type SheetView = "menu" | "pick-list";

/**
 * TASK-172 — menu "..." de filme, achado real (não existia). Porta
 * fiel de `SeriesQuickActionsSheet.tsx`, sem favoritar/assistir
 * depois/parar de assistir — pra filme, favorito já é botão
 * principal (`MovieActions.tsx`), e "assistir depois" também;
 * duplicar aqui seria redundante. Só o que faltava mesmo: adicionar
 * a lista, recomendar, remover, compartilhar.
 */
export function MovieQuickActionsSheet({ movieId, movieTitle, onRemoved, onClose }: MovieQuickActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [view, setView] = useState<SheetView>("menu");
  const { lists, isLoading: listsLoading, creating, create } = useMyLists();
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [addedListId, setAddedListId] = useState<string | null>(null);
  const [showRecommend, setShowRecommend] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleShare() {
    try {
      await Share.share({ message: movieTitle, title: movieTitle });
    } catch (error) {
      console.error("[MovieQuickActionsSheet] Falha ao compartilhar", error);
    }
    onClose();
  }

  async function handleAddToList(listId: string) {
    try {
      await addToList(listId, "movie", movieId);
      setAddedListId(listId);
    } catch (error) {
      console.error("[MovieQuickActionsSheet] Falha ao adicionar à lista", error);
    }
  }

  async function handleCreateAndAdd() {
    if (!newListName.trim()) return;
    const ok = await create(newListName);
    if (ok) setNewListName("");
    setShowNewListForm(false);
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await removeMovieFromLibrary(movieId);
      onRemoved();
      onClose();
    } catch (error) {
      console.error("[MovieQuickActionsSheet] Falha ao remover filme", error);
      setRemoving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* TASK-176 (achado real, comparado com CreatePostButton.tsx que já funcionava) — o `KeyboardAvoidingView` precisa ser filho DIRETO do `Modal`, sem nenhum `Pressable`/View extra o envolvendo, ou o cálculo de altura no Android não funciona direito. O "tocar fora fecha" virou um `Pressable` de fundo separado (posição absoluta, atrás da folha), não mais um wrapper por cima do KeyboardAvoidingView. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]}>
          {confirmingRemove ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>Remover este filme?</Text>
              <Text variant="muted" style={styles.confirmMessage}>
                Isso apaga o status de &quot;{movieTitle}&quot; — não dá pra desfazer.
              </Text>
              <View style={styles.confirmButtons}>
                <Pressable style={styles.confirmCancelButton} onPress={() => setConfirmingRemove(false)}>
                  <Text>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.confirmRemoveButton} onPress={handleRemove} disabled={removing}>
                  <Text style={styles.confirmRemoveText}>{removing ? "Removendo..." : "Remover"}</Text>
                </Pressable>
              </View>
            </View>
          ) : view === "pick-list" ? (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.pickListScroll}>
              <View style={styles.pickListHeader}>
                <Pressable onPress={() => setView("menu")} hitSlop={8}>
                  <Feather name="arrow-left" size={16} color={colors.muted} />
                </Pressable>
                <Text numberOfLines={1} variant="muted" style={styles.sheetTitle}>
                  Adicionar &quot;{movieTitle}&quot; a uma lista
                </Text>
              </View>

              {listsLoading && (
                <View style={styles.loadingListsSkeleton}>
                  <Skeleton width="100%" height={16} />
                  <Skeleton width="80%" height={16} />
                </View>
              )}

              {!listsLoading && lists && lists.length === 0 && !showNewListForm && (
                <Text variant="muted" style={styles.loadingLists}>
                  Você ainda não tem nenhuma lista.
                </Text>
              )}

              {lists?.map((list) => (
                <Pressable key={list.id} style={styles.actionRow} onPress={() => handleAddToList(list.id)}>
                  <Feather name={addedListId === list.id ? "check" : "list"} size={16} color={addedListId === list.id ? colors.primary : colors.text} />
                  <Text style={[styles.actionLabel, addedListId === list.id && { color: colors.primary }]}>{list.name}</Text>
                </Pressable>
              ))}

              {showNewListForm ? (
                <View style={styles.newListForm}>
                  <TextInput
                    autoFocus
                    value={newListName}
                    onChangeText={setNewListName}
                    placeholder="Nome da lista"
                    placeholderTextColor={colors.muted}
                    maxLength={80}
                    style={styles.newListInput}
                  />
                  <Pressable style={styles.newListSaveButton} onPress={handleCreateAndAdd} disabled={!newListName.trim() || creating}>
                    <Feather name="check" size={16} color={colors.background} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.actionRow} onPress={() => setShowNewListForm(true)}>
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.primary }]}>Criar nova lista</Text>
                </Pressable>
              )}
            </ScrollView>
          ) : (
            <View>
              <Text numberOfLines={1} variant="muted" style={styles.sheetTitle}>
                {movieTitle}
              </Text>

              <ActionRow icon="list" label="Adicionar a lista" onPress={() => setView("pick-list")} />
              <ActionRow icon="send" label="Recomendar pra alguém" onPress={() => setShowRecommend(true)} />
              <ActionRow icon="trash-2" label="Remover filme" danger onPress={() => setConfirmingRemove(true)} />
              <ActionRow icon="share-2" label="Compartilhar" onPress={handleShare} />

              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Feather name="x" size={16} color={colors.muted} />
                <Text variant="muted">Cancelar</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {showRecommend && (
        <RecommendSheet
          mediaType="movie"
          mediaId={movieId}
          mediaTitle={movieTitle}
          onClose={() => setShowRecommend(false)}
        />
      )}
    </Modal>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable style={styles.actionRow} onPress={onPress}>
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetTitle: {
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 12,
    fontWeight: "600",
  },
  pickListScroll: {
    maxHeight: 420,
  },
  pickListHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  loadingLists: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingListsSkeleton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  newListForm: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
  },
  newListInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm - 2,
    fontSize: 14,
    color: colors.text,
  },
  newListSaveButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  actionLabel: {
    fontSize: 14,
  },
  cancelButton: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  confirm: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmTitle: {
    fontSize: 14,
    color: colors.text,
  },
  confirmMessage: {
    textAlign: "center",
  },
  confirmButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    width: "100%",
  },
  confirmCancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmRemoveButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  confirmRemoveText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
