import Link from "next/link";
import { Plus } from "lucide-react";

export interface EmptyShelfProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

/**
 * TASK-022, item 5 — "card elegante", nunca deixa a seção em branco.
 *
 * UNIFICAÇÃO (achado real, auditoria de UX) — existia um segundo
 * componente (`HomeEmptyState.tsx`) fazendo exatamente a mesma
 * coisa (mesmas props, mesmo botão de ação), só que com um visual
 * diferente (borda sólida em vez de tracejada, cantos menos
 * arredondados, sem opacidade no fundo) — resultado: trocar de aba
 * "Minha Lista" pra "Em breve" na Central de Séries mudava o estilo
 * do card vazio no meio do caminho, sem motivo. Movido pra `media/`
 * (mesmo raciocínio de `HomeTabs.tsx` — vira o componente
 * compartilhado entre Séries e Filmes) e todo mundo que usava
 * `HomeEmptyState` passou a usar este.
 *
 * BUG REAL CORRIGIDO NA RAIZ (2026-09-01, reportado — "o botão que
 * você fez, não tem o mesmo efeito do padrão dos botões do app") —
 * o botão de ação aqui era `rounded-lg bg-primary` liso, com
 * `hover:opacity-90` — um estilo PRÓPRIO, inventado só pra este
 * componente, que nunca existiu em nenhum outro CTA primário do
 * app. O padrão de verdade (documentado como tal em
 * `EpisodeDetailView.tsx`, "mesmo padrão da pílula 'gel' âmbar —
 * aba ativa/CTA primário de `ExploreTabs.tsx`/`StatisticsCard.tsx`")
 * é `rounded-full` + gradiente radial âmbar + o `boxShadow` inset
 * duplo que dá o brilho "gel" (realce claro em cima, sombra quente
 * embaixo) — usado em TODO botão/pílula âmbar primário real do app,
 * exceto este. Substituído pelo padrão de verdade, ícone "+" incluso
 * (o print de referência mostra o botão assim).
 *
 * REVERTIDO (2026-09-01, seguinte — "a ilustração não pode ficar
 * dentro de um Card... sem borda, sem sombra, sem padding, sem
 * overflow hidden, sem nenhum estilo de Card") — tinha ganhado uma
 * variante "rica" temporária (`illustration`/`subtitle`/
 * `dividerLabel`) pro estado vazio de Séries/Home. Removida de
 * volta: por definição, ESTE componente É um cartão (borda
 * tracejada + fundo "vidro" translúcido envolvendo tudo) — não dá
 * pra pedir "sem nenhum estilo de card" e continuar usando um
 * componente que É um card por dentro. O estado vazio ilustrado
 * agora é `EmptyLibraryHero.tsx` (novo, solto, sem wrapper nenhum);
 * `EmptyShelf` volta a ser só o card simples de texto+botão que
 * sempre foi, usado pelas outras 11 telas sem ilustração (Filmes,
 * "Em breve", Assistir depois, Pausadas, Concluídas etc.).
 */
export function EmptyShelf({ message, actionLabel, actionHref }: EmptyShelfProps) {
  return (
    // "Vidro" (toque leve — mantém a borda tracejada, ganha blur/gradiente translúcido em vez de `bg-surface/50` opaco).
    <div
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 py-8 text-center backdrop-blur-[10px] backdrop-saturate-[160%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.10), transparent 60%), rgba(255,255,255,0.04)",
      }}
    >
      <p className="text-sm text-muted">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-1 flex items-center gap-1.5 rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-background shadow-lg transition-transform active:scale-95"
          style={{
            background: "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.75} />
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
