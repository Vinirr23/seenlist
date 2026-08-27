"use client";

import { cn } from "@seenlist/utils";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const MOODS = [
  { key: "shocked", emoji: "😵" },
  { key: "frustrated", emoji: "😤" },
  { key: "sad", emoji: "😭" },
  { key: "thoughtful", emoji: "🤔" },
  { key: "touched", emoji: "🥺" },
  { key: "entertained", emoji: "😆" },
  { key: "scared", emoji: "😱" },
  { key: "bored", emoji: "😑" },
  { key: "content", emoji: "😌" },
  { key: "hyped", emoji: "🤩" },
  { key: "confused", emoji: "🙃" },
  { key: "tense", emoji: "😬" },
] as const;

/** TASK-173 (antes: escolha única) — múltipla escolha: cada toque alterna esse humor na lista, sem desmarcar os outros. Guardado em `reviews.mood` como array de `key` (estável, independe do rótulo em português mudar depois). */
export function EpisodeMoodPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (moods: string[]) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-4 gap-2">
      {MOODS.map((mood) => {
        const selected = value.includes(mood.key);
        // "Vidro" (mesmo padrão dos chips neutros do Explorar — só no estado não selecionado)
        return (
          <button
            key={mood.key}
            type="button"
            onClick={() => {
              hapticTick();
              onChange(selected ? value.filter((m) => m !== mood.key) : [...value, mood.key]);
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 backdrop-blur-[10px] backdrop-saturate-[160%] transition-colors",
              selected ? "border-primary bg-primary/10" : "border-white/10"
            )}
            style={
              selected
                ? undefined
                : {
                    background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
                  }
            }
          >
            <span className="text-2xl">{mood.emoji}</span>
            <span className={cn("text-center text-[10px] font-medium leading-tight", selected ? "text-primary" : "text-muted")}>
              {t(`episode.mood.${mood.key}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
