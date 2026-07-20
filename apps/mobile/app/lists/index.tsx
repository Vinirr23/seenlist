import { useState } from "react";
import { ScrollView, View, TextInput, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useMyLists } from "@/lib/useMyLists";
import { Screen, Text } from "@/components/ui";
import { AvatarRowSkeleton } from "@/components/media/AvatarRowSkeleton";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

/**
 * TASK-106 (Listas) — porta de `ListsPageView.tsx` + `ListsView.tsx`
 * do web. TASK-172 — cada linha agora leva pra `/lists/[id]`, onde
 * dá pra ver o conteúdo, remover item e apagar a lista; antes disso
 * o nome não estava ligado a rota nenhuma (mesma lacuna existia no
 * web).
 */
export default function ListsScreen() {
  const router = useRouter();
  const { lists, isLoading, isError, creating, create } = useMyLists();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    const ok = await create(name);
    if (ok) {
      setName("");
      setShowForm(false);
    }
  }

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text variant="subtitle">Minhas listas</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable style={styles.createButton} onPress={() => setShowForm((v) => !v)}>
            <Feather name="plus" size={16} color={colors.background} />
            <Text style={styles.createButtonText}>Criar nova lista</Text>
          </Pressable>

          {showForm && (
            <View style={styles.form}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nome da lista"
                placeholderTextColor={colors.muted}
                maxLength={80}
                autoFocus
                style={styles.input}
              />
              <Pressable style={styles.saveButton} onPress={handleCreate} disabled={!name.trim() || creating}>
                <Text style={styles.saveButtonText}>{creating ? "Criando…" : "Salvar"}</Text>
              </Pressable>
            </View>
          )}

          {isLoading ? (
            <AvatarRowSkeleton />
          ) : isError ? (
            <Text variant="muted" style={styles.centerText}>
              Não foi possível carregar suas listas agora.
            </Text>
          ) : !lists || lists.length === 0 ? (
            <Text variant="muted" style={styles.centerText}>
              Você ainda não criou nenhuma lista.
            </Text>
          ) : (
            <View style={styles.list}>
              {lists.map((list) => (
                <Pressable key={list.id} style={styles.listRow} onPress={() => router.push(`/lists/${list.id}`)}>
                  <Feather name="check-square" size={18} color={colors.primary} />
                  <Text style={styles.listName}>{list.name}</Text>
                  <Feather name="chevron-right" size={18} color={colors.muted} style={{ marginLeft: "auto" }} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  createButtonText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.background,
  },
  form: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  saveButton: {
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.background,
  },
  centerText: {
    textAlign: "center",
    marginTop: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  listName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
});
