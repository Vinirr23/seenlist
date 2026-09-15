import { useEffect, useState } from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useDebouncedValue } from "@seenlist/hooks";
import { addSearchHistoryTerm, readSearchHistory, removeSearchHistoryTerm } from "@/lib/search";
import { Text, Glass } from "@/components/ui";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
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
  const { t } = useTranslation();

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
      {/*
        * PORTE DO WEB (2026-09-04, "vidro que falta") — a caixa de busca
        * e o painel de histórico viraram vidro (web, `SearchBar.tsx`:
        * "antes era opaca (`border-border bg-surface`)"). O `TextInput`
        * por dentro continua transparente — campo de formulário não
        * recebe vidro. O painel de histórico, no web, é o "painel
        * escuro translúcido" (base `rgba(20,22,30,0.85)` em vez do
        * branco 10% dos cartões) — reproduzido aqui com o mesmo valor
        * como `backgroundColor` do `Glass`, que fica abaixo do
        * gradiente branco, igual à ordem de camadas do CSS.
        */}
      <Glass style={styles.inputRow}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={setValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t("search.placeholder")}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
        {!!value && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Feather name="x" size={16} color={colors.muted} />
          </Pressable>
        )}
      </Glass>

      {showHistory && (
        <Glass style={styles.historyBox}>
          <Text variant="muted" style={styles.historyLabel}>
            {t("search.recentSearches").toUpperCase()}
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
        </Glass>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // CORREÇÃO (2026-09-04, "vidro que falta") — fundo/borda sólidos
  // removidos (vira `<Glass>`). Raio segue `radius.md`: o web usa
  // `rounded-lg` aqui, não o `rounded-2xl` dos cartões.
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  input: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  // CORREÇÃO (2026-09-04, "vidro que falta") — vira `<Glass>`, mas com
  // a base ESCURA do web (`rgba(20,22,30,0.85)`) em vez do branco 10%
  // dos cartões: é um painel flutuante sobre conteúdo, precisa esconder
  // o que passa por baixo (mesmo critério do dropdown do web).
  historyBox: {
    marginTop: spacing.sm,
    backgroundColor: "rgba(20,22,30,0.85)",
    borderRadius: radius.md,
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
