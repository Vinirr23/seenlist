import { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { MovieWatchStatus } from "@seenlist/types";
import { useIsMovieFavorite } from "@/lib/useMovieDetails";
import { incrementMovieRewatch } from "@/lib/movieDetails";
import { hapticTick } from "@/lib/haptics";
import { OptionSheet } from "@/components/settings/OptionSheet";
import { Text, Glass } from "@/components/ui";
import { colors, radius, spacing } from "@/lib/theme";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-172 (ajuste 2 — a pedido, "tudo apertado") — o "..." saiu
 * daqui de vez e foi pro canto superior direito da capa
 * (`MovieHeader.tsx`, prop `onMorePress`), mesmo lugar exato de
 * `SeriesHeader.tsx` — agora fica só: Assistido, Assistir depois,
 * coração de favorito.
 *
 * CORREÇÃO (a pedido — auditoria mais rigorosa, achado real: só
 * existia no web) — porta de TASK-047: tocar em "Assistido" quando
 * JÁ está assistido não desmarca direto — abre "Marcar como..."
 * ("Não assistido" / "Reassistido"), igual TV Time. Antes, tocar de
 * novo desmarcava na hora, sem perguntar nada.
 */
export function MovieActions({
  movieId,
  currentStatus,
  busy,
  onChange,
}: {
  movieId: number;
  currentStatus: MovieWatchStatus | null;
  busy: boolean;
  onChange: (status: MovieWatchStatus) => void;
}) {
  const { t } = useTranslation();
  const OPTIONS: { status: MovieWatchStatus; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { status: "watched", label: t("episode.watched"), icon: "check" },
    { status: "want_to_watch", label: t("seriesCategory.wantToWatch"), icon: "plus" },
  ];
  const { isFavorite, busy: favoriteBusy, toggle: toggleFavorite } = useIsMovieFavorite(movieId);
  const [showWatchedActions, setShowWatchedActions] = useState(false);

  function handlePress(option: (typeof OPTIONS)[number]) {
    if (option.status === "watched" && currentStatus === "watched") {
      hapticTick();
      setShowWatchedActions(true);
      return;
    }
    onChange(option.status);
  }

  return (
    <View>
      <View style={styles.row}>
        {/*
          CORREÇÃO (2026-09-10, print do usuário — "faltou o glass em
          'assistido e quero assistir'") — os dois botões eram um
          `Pressable` com borda sólida, sem nenhum vidro. No web
          (`MovieActions.tsx`) os dois SEMPRE têm
          `backdrop-blur-[10px] backdrop-saturate-[160%]` — mesma
          receita `light` do `Glass`, tanto no estado ativo quanto no
          inativo; só a cor de fundo/borda muda entre os dois (o
          comentário do web, "mesmo padrão dos chips neutros do
          Explorar", descreve de onde veio a receita, não que só o
          inativo é vidro).
        */}
        {OPTIONS.map((option) => {
          const active = currentStatus === option.status;
          return (
            <Pressable key={option.status} disabled={busy} onPress={() => handlePress(option)} style={styles.buttonWrap}>
              <Glass style={[styles.button, active && styles.buttonActive]} variant="light">
                <Feather name={option.icon} size={16} color={active ? colors.primary : colors.muted} />
                <Text variant="label" style={active ? styles.labelActive : styles.label}>
                  {option.label}
                </Text>
              </Glass>
            </Pressable>
          );
        })}

        <Pressable hitSlop={8} style={styles.iconButton} disabled={favoriteBusy} onPress={toggleFavorite}>
          <Feather name="heart" size={16} color={isFavorite ? colors.danger : colors.muted} />
        </Pressable>
      </View>

      {showWatchedActions && (
        <OptionSheet
          title={t("episode.markAs")}
          onDismiss={() => setShowWatchedActions(false)}
          actions={[
            {
              label: t("episode.notWatchedAction"),
              onPress: () => {
                hapticTick();
                onChange("watched");
                setShowWatchedActions(false);
              },
            },
            {
              label: t("episode.rewatchedAction"),
              onPress: async () => {
                hapticTick();
                setShowWatchedActions(false);
                try {
                  await incrementMovieRewatch(movieId);
                } catch (error) {
                  console.error("[MovieActions] Falha ao registrar reassistido", error);
                }
              },
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  /** O `Pressable` só cuida do toque — o vidro (`Glass`) é quem desenha o botão. */
  buttonWrap: {
    flex: 1,
  },
  button: {
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  /** `border-primary bg-primary/10` do web — a receita `light` do `Glass` já dá o blur/saturate; só a cor muda. */
  buttonActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(232,163,61,0.1)",
  },
  label: {
    color: colors.muted,
    fontSize: 11,
  },
  labelActive: {
    color: colors.primary,
    fontSize: 11,
  },
  iconButton: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
