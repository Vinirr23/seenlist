import Image from "next/image";
import { tmdbImage } from "@/lib/tmdb/image";

/**
 * A PEDIDO — refinamento da aba Sobre (série), item 6: "adicionar
 * uma seção horizontal com screenshots da série — uma das melhores
 * formas de aumentar o interesse do usuário". Dado já vem junto da
 * mesma chamada que busca o resto dos detalhes (`images` no
 * `append_to_response` do TMDB) — nenhuma requisição nova.
 */
export function BackdropGallery({ paths }: { paths: string[] }) {
  if (paths.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-1">
      {paths.map((path) => {
        const url = tmdbImage(path, "w780");
        if (!url) return null;
        return (
          // "Vidro" (mesmo padrão de DiscoverCard.tsx)
          <div
            key={path}
            className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
            style={{
              background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
            }}
          >
            <Image src={url} alt="" fill sizes="160px" className="object-cover" />
          </div>
        );
      })}
    </div>
  );
}
