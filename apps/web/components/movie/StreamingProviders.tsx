import Image from "next/image";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

export function StreamingProviders({ providers }: { providers: WatchProvider[] }) {
  if (providers.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-text">Onde assistir</h2>
      <div className="flex flex-wrap gap-3">
        {providers.map((provider) => {
          const logoUrl = tmdbImage(provider.logoPath, "w185");
          return (
            <div key={provider.id} className="flex flex-col items-center gap-1">
              <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-surface">
                {logoUrl && (
                  <Image src={logoUrl} alt={provider.name} fill sizes="48px" className="object-cover" />
                )}
              </div>
              <p className="max-w-[64px] truncate text-center text-[10px] text-muted">{provider.name}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
