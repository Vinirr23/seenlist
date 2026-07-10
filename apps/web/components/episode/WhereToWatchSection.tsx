import Image from "next/image";
import type { WatchProvider } from "@seenlist/types";
import { tmdbImage } from "@/lib/tmdb/image";

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
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-text">Onde assistir</h2>
      {providers.length === 0 ? (
        <p className="text-sm text-muted">Não disponível na sua região.</p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {providers.map((provider) => {
            const logoUrl = tmdbImage(provider.logoPath, "w185");
            return (
              <div key={provider.id} className="flex flex-col items-center gap-1">
                <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-surface">
                  {logoUrl && <Image src={logoUrl} alt={provider.name} fill sizes="48px" className="object-cover" />}
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
