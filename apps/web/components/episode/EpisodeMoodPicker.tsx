"use client";

import { cn } from "@seenlist/utils";
import { hapticTick } from "@/lib/haptics";

const MOODS = [
  { key: "shocked", emoji: "😵", label: "Chocado" },
  { key: "frustrated", emoji: "😤", label: "Frustrado" },
  { key: "sad", emoji: "😭", label: "Triste" },
  { key: "thoughtful", emoji: "🤔", label: "Reflexivo" },
  { key: "touched", emoji: "🥺", label: "Comovido" },
  { key: "entertained", emoji: "😆", label: "Entretido" },
  { key: "scared", emoji: "😱", label: "Assustado" },
  { key: "bored", emoji: "😑", label: "Entediado" },
  { key: "content", emoji: "😌", label: "Compreensivo" },
  { key: "hyped", emoji: "🤩", label: "Empolgado" },
  { key: "confused", emoji: "🙃", label: "Confuso" },
  { key: "tense", emoji: "😬", label: "Tenso" },
];

/** TASK-067 — "Como você se sentiu?", escolha única (tocar de novo no mesmo desmarca). Guardado em `reviews.mood` como a `key` (estável, independe do rótulo em português mudar depois). */
export function EpisodeMoodPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (mood: string | null) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {MOODS.map((mood) => {
        const selected = value === mood.key;
        return (
          <button
            key={mood.key}
            type="button"
            onClick={() => {
              hapticTick();
              onChange(selected ? null : mood.key);
            }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-colors",
              selected ? "border-primary bg-primary/10" : "border-border bg-surface"
            )}
          >
            <span className="text-2xl">{mood.emoji}</span>
            <span className={cn("text-center text-[10px] font-medium leading-tight", selected ? "text-primary" : "text-muted")}>
              {mood.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
