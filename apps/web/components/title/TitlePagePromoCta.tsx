import Link from "next/link";
import { ChevronRight, LibraryBig } from "lucide-react";

/**
 * A PEDIDO (2026-10-09 — SEO Fase 2, página pública de título). CTA
 * discreto só, como combinado — nenhuma ação que precise de login
 * aparece nesta página; isto apenas LEVA pra uma que precisa. Mesmo
 * "glass-row" já usado em `MovieDetailsView.tsx`/`SeriesDetailsView.tsx`
 * (link pra "ver todos os comentários"). `href` aponta pra rota real
 * do app (`/movies/[id]`/`/series/[id]`) — quem não tem sessão cai no
 * middleware normal (`/login?redirectTo=...`) e volta exatamente pra
 * esta ficha depois de entrar; quem já tem sessão vai direto.
 */
export function TitlePagePromoCta({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-text backdrop-blur-[18px] backdrop-saturate-[180%] hover:border-primary/40"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
      <span className="flex items-center gap-2">
        <LibraryBig className="h-4 w-4 text-muted" strokeWidth={2} />
        Marcar como assistido, avaliar e acompanhar no SeenList
      </span>
      <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
    </Link>
  );
}
