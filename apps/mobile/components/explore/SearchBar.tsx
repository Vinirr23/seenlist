import { useEffect, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useDebouncedValue } from "@seenlist/hooks";
import { addSearchHistoryTerm, readSearchHistory, removeSearchHistoryTerm } from "@/lib/search";
import { Text } from "@/components/ui";
import { colors, radius, spacing, fontSize } from "@/lib/theme";

const DEBOUNCE_MS = 400;

/**
 * TASK-094 (Explorar nativa) — porta de `SearchBar.tsx` do web.
 * `onBlur` usa um pequeno atraso antes de esconder o histórico (em
 * vez do truque `onMouseDown` do web, que não existe em RN) — dá
 * tempo do toque num item do histórico ser processado antes da
 * lista sumir.
 */
export function SearchBar({ onDebouncedChange }: { onDebouncedChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const debounced = useDebouncedValue(value, DEBOUNCE_MS);

  useEffect(() => {
    readSearchHistory().then(setHistory);
  }, []);

  useEffect(() => {
    onDebouncedChange(debounced);
    if (debounced.trim()) {
      addSearchHistoryTerm(debounced).then(setHistory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  function handleClear() {
    setValue("");
    onDebouncedChange("");
  }

  function handleSelectHistoryTerm(term: string) {
    setValue(term);
  }

  function handleRemoveHistoryTerm(term: string) {
    removeSearchHistoryTerm(term).then(setHistory);
  }

  const showHistory = focused && !value && history.length > 0;

  return (
    <View>
      <View style={styles.inputRow}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Pesquisar filmes e séries..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
        {!!value && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Feather name="x" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {showHistory && (
        <View style={styles.historyBox}>
          <Text variant="muted" style={styles.historyLabel}>
            PESQUISAS RECENTES
          </Text>
          {history.map((term) => (
            <View key={term} style={styles.historyRow}>
              <Feather name="clock" size={14} color={colors.muted} />
              <Pressable style={styles.historyTermButton} onPress={() => handleSelectHistoryTerm(term)}>
                <Text numberOfLines={1}>{term}</Text>
              </Pressable>
              <Pressable onPress={() => handleRemoveHistoryTerm(term)} hitSlop={8}>
                <Feather name="x" size={14} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  input: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  historyBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  historyLabel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyTermButton: {
    flex: 1,
  },
});
