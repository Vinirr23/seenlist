"use client";

import Image from "next/image";
import { Ellipsis, ShieldOff } from "lucide-react";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { cn } from "@seenlist/utils";
import { hapticTick } from "@/lib/haptics";

const FIXED_OPTIONS = [
  { key: "other", label: "Outro" },
  { key: "unofficial", label: "Não oficial" },
] as const;

/**
 * TASK-067 — "Onde você assistiu?". Os streamings reais vêm do
 * mesmo `watchProviders` que `WhereToWatchSection` já usa (nenhuma
 * consulta nova ao TMDB) — "Outro" e "Não oficial" são opções fixas
 * que sempre aparecem, cobrindo quem assistiu em algum lugar que o
 * TMDB não lista pra essa região (canal de TV aberta, torrent, DVD
 * etc.), igual ao TV Time. `watchedPlatform` guarda o nome do
 * provedor (ex.: "Netflix") ou a chave fixa ("other"/"unofficial").
 */
export function EpisodeWatchedPlatformPicker({
  providers,
  value,
  onChange,
}: {
  providers: WatchProvider[];
  value: string | null;
  onChange: (platform: string | null) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {providers.map((provider) => {
        const logoUrl = tmdbImage(provider.logoPath, "w185");
        const selected = value === provider.name;
        return (
          <button
            key={provider.id}
            type="button"
            onClick={() => {
              hapticTick();
              onChange(selected ? null : provider.name);
            }}
            className="w-16 shrink-0 text-center"
          >
            <div
              className={cn(
                "relative mx-auto h-12 w-12 overflow-hidden rounded-xl bg-surface ring-2 transition-colors",
                selected ? "ring-primary" : "ring-transparent"
              )}
            >
              {logoUrl && <Image src={logoUrl} alt={provider.name} fill sizes="48px" className="object-cover" />}
            </div>
            <p className={cn("mt-1 truncate text-[10px]", selected ? "font-medium text-primary" : "text-muted")}>
              {provider.name}
            </p>
          </button>
        );
      })}

      {FIXED_OPTIONS.map((option) => {
        const selected = value === option.key;
        const Icon = option.key === "other" ? Ellipsis : ShieldOff;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              hapticTick();
              onChange(selected ? null : option.key);
            }}
            className="w-16 shrink-0 text-center"
          >
            <div
              className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-xl border-2 bg-surface transition-colors",
                selected ? "border-primary text-primary" : "border-border text-muted"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <p className={cn("mt-1 truncate text-[10px]", selected ? "font-medium text-primary" : "text-muted")}>
              {option.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
