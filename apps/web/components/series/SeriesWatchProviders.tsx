import Image from "next/image";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * A PEDIDO (2026-08-25) — "onde assistir" também na tela de Série, antes
 * da sinopse (já existia pra Filme e Episódio, faltava só aqui). Mesmo
 * visual/dado de `movie/StreamingProviders.tsx` (que já é "vidro" — essa
 * troca aconteceu na mesma passada). Comportamento com lista vazia segue
 * o padrão do Filme (esconde a seção inteira), não o do Episódio (que
 * mostra "não disponível na sua região" — pedido específico daquela
 * tarefa, não repetido aqui por padrão; fácil de trocar se preferir).
 */
export function SeriesWatchProviders({ providers }: { providers: WatchProvider[] }) {
  const { t } = useTranslation();
  if (providers.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-text">{t("movie.whereToWatch")}</h2>
      <div className="flex flex-wrap gap-3">
        {providers.map((provider) => {
          const logoUrl = tmdbImage(provider.logoPath, "w185");
          return (
            <div key={provider.id} className="flex flex-col items-center gap-1">
              {/* "Vidro" (mesmo padrão de DiscoverCard.tsx) — A PEDIDO, ícones um pouco maiores. */}
              <div
                className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
                style={{
                  background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
                }}
              >
                {logoUrl && <Image src={logoUrl} alt={provider.name} fill sizes="56px" className="object-cover" />}
              </div>
              <p className="max-w-[64px] truncate text-center text-[10px] text-muted">{provider.name}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
