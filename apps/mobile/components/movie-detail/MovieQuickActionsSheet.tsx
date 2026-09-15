import { useState } from "react";
import { View, Modal, Pressable, TextInput, ScrollView, Share, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useMyLists } from "@/lib/useMyLists";
import { addToList } from "@/lib/lists";
import { removeMovieFromLibrary } from "@/lib/movieDetails";
import { hapticTick, hapticWarning } from "@/lib/haptics";
import { Text, Skeleton, Glass } from "@/components/ui";
import { colors, radius, spacing, scrim } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
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
 *
 * CORREÇÃO DE CAUSA RAIZ (2026-09-10, achado numa auditoria pedida —
 * "você está sempre pulando os botões de cima e as folhas") — este
 * arquivo nunca tinha recebido a mesma passada de vidro que
 * `SeriesQuickActionsSheet.tsx` já tinha (mtime bem mais antigo que o
 * resto da pasta, nunca tocado nesta rodada de portes). A folha era
 * `colors.surface` chapado; no web (`MovieQuickActionsSheet.tsx`) ela
 * é vidro: `border-t border-white/10 backdrop-blur-[18px]
 * backdrop-saturate-[180%]` sobre `radial(75% 100% at 14% 15%,
 * rgba(255,255,255,0.17), transparent 60%), rgba(20,22,30,0.85)` — a
 * receita `dark` do `Glass`, valor por valor (mesma correção,
 * idêntica, já aplicada em `SeriesQuickActionsSheet.tsx`).
 *
 * Ícone de "Adicionar a lista" também trocado: era `Feather "list"`
 * (uma lista lisa, sem sinal de adicionar); o web usa `ListPlus` do
 * lucide (lista com um "+"). `MaterialCommunityIcons "playlist-plus"`
 * é o mais parecido disso disponível no app.
 */
export function MovieQuickActionsSheet({ movieId, movieTitle, onRemoved, onClose }: MovieQuickActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
    hapticTick();
    try {
      await addToList(listId, "movie", movieId);
      setAddedListId(listId);
    } catch (error) {
      console.error("[MovieQuickActionsSheet] Falha ao adicionar à lista", error);
    }
  }

  async function handleCreateAndAdd() {
    if (!newListName.trim()) return;
    hapticTick();
    const ok = await create(newListName);
    if (ok) setNewListName("");
    setShowNewListForm(false);
  }

  async function handleRemove() {
    hapticWarning();
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
        <Glass style={[styles.sheet, { paddingBottom: spacing.lg + insets.bottom }]} variant="dark">
          {confirmingRemove ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmTitle}>{t("movie.removeThisMovie")}</Text>
              <Text variant="muted" style={styles.confirmMessage}>
                {t("movie.removeMovieMessage", { title: movieTitle })}
              </Text>
              <View style={styles.confirmButtons}>
                <Pressable style={styles.confirmCancelButton} onPress={() => setConfirmingRemove(false)}>
                  <Text>{t("common.cancel")}</Text>
                </Pressable>
                <Pressable style={styles.confirmRemoveButton} onPress={handleRemove} disabled={removing}>
                  <Text style={styles.confirmRemoveText}>{removing ? t("common.removing") : t("common.remove")}</Text>
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
                  {t("movie.addToListTitle", { title: movieTitle })}
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
                  {t("movie.noListsYet")}
                </Text>
              )}

              {lists?.map((list) => (
                <Pressable key={list.id} style={styles.actionRow} onPress={() => handleAddToList(list.id)}>
                  {addedListId === list.id ? (
                    <Feather name="check" size={16} color={colors.primary} />
                  ) : (
                    <MaterialCommunityIcons name="playlist-plus" size={18} color={colors.text} />
                  )}
                  <Text style={[styles.actionLabel, addedListId === list.id && { color: colors.primary }]}>{list.name}</Text>
                </Pressable>
              ))}

              {showNewListForm ? (
                <View style={styles.newListForm}>
                  <TextInput
                    autoFocus
                    value={newListName}
                    onChangeText={setNewListName}
                    placeholder={t("profile.listNamePlaceholder")}
                    placeholderTextColor={colors.muted}
                    maxLength={80}
                    style={styles.newListInput}
                  />
                  <Pressable hitSlop={8} style={styles.newListSaveButton} onPress={handleCreateAndAdd} disabled={!newListName.trim() || creating}>
                    <Feather name="check" size={16} color={colors.background} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.actionRow} onPress={() => setShowNewListForm(true)}>
                  <Feather name="plus" size={16} color={colors.primary} />
                  <Text style={[styles.actionLabel, { color: colors.primary }]}>{t("profile.createNewList")}</Text>
                </Pressable>
              )}
            </ScrollView>
          ) : (
            <View>
              <Text numberOfLines={1} variant="muted" style={styles.sheetTitle}>
                {movieTitle}
              </Text>

              <Pressable style={styles.actionRow} onPress={() => setView("pick-list")}>
                <MaterialCommunityIcons name="playlist-plus" size={18} color={colors.text} />
                <Text style={styles.actionLabel}>{t("movie.addToList")}</Text>
              </Pressable>
              <ActionRow icon="send" label={t("social.recommendToSomeone")} onPress={() => setShowRecommend(true)} />
              <ActionRow icon="trash-2" label={t("movie.removeMovie")} danger onPress={() => setConfirmingRemove(true)} />
              <ActionRow icon="share-2" label={t("social.share")} onPress={handleShare} />

              <Pressable style={styles.cancelButton} onPress={onClose}>
                <Feather name="x" size={16} color={colors.muted} />
                <Text variant="muted">{t("common.cancel")}</Text>
              </Pressable>
            </View>
          )}
        </Glass>
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
    backgroundColor: scrim.modal,
  },
  /**
   * PORTE DO WEB (2026-09-10, mesma correção de `SeriesQuickActionsSheet.tsx`)
   * — a folha era `colors.surface` chapado; agora é a receita `dark`
   * do `Glass`. `rounded-t-2xl` = 16 e `p-4` = 16 já batiam.
   */
  sheet: {
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
    gap: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionLabel: {
    fontSize: 14,
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
