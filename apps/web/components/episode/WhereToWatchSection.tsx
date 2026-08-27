import Image from "next/image";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-030 — mesmo visual de components/movie/StreamingProviders.tsx,
 * mas diferente dele de propósito num ponto: aqui, lista vazia
 * mostra "Não disponível na sua região" (pedido explícito da
 * tarefa), em vez de esconder a seção inteira. Não editei o
 * componente de filme pra isso — mudar o comportamento dele também
 * não foi pedido, e poderia alterar uma tela que já está do jeito
 * que foi decidido antes.
 */
export function WhereToWatchSection({ providers }: { providers: WatchProvider[] }) {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-text">{t("movie.whereToWatch")}</h2>
      {providers.length === 0 ? (
        <p className="text-sm text-muted">{t("episode.notAvailableInRegion")}</p>
      ) : (
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
      )}
    </section>
  );
}
