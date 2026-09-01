import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";

export interface EmptyShelfProps {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  /**
   * A PEDIDO (2026-09-01 — "copia a ideia desse print", print com
   * sofá/pipoca, título+subtítulo, botão e um "OU" antes da fileira
   * de populares) — 3 props NOVAS, todas opcionais. Nenhuma delas
   * muda em nada as outras 11 telas que já usam `EmptyShelf` sem
   * passá-las (Filmes, "Em breve", Assistir depois, Pausadas,
   * Concluídas etc.) — só o estado vazio de Séries/Home
   * (`MinhaListaSection.tsx`) usa a versão "rica" por enquanto.
   */
  illustration?: ReactNode;
  subtitle?: string;
  dividerLabel?: string;
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
 * CORREÇÃO NA RAIZ (2026-09-01, seguinte — "no print 2... as legendas
 * têm hierarquia, o botão é maior... copie exatamente o print 2") —
 * comparando os dois prints lado a lado: o título "rico" (16px) e o
 * botão (px-6 py-3, 14px) estavam pequenos demais perto da ilustração
 * agora maior (ver `EmptyLibraryIllustration` em
 * `MinhaListaSection.tsx`), sem o contraste de tamanho que o print de
 * referência mostra entre título/subtítulo/botão. Só a variante RICA
 * (com ilustração) ganhou reforço — título maior (16px → 20px),
 * subtítulo um degrau acima (12px → 14px, mais fácil de ler perto de
 * um título maior) e botão maior (padding e texto maiores, ícone
 * 16px → 20px) — as outras 11 telas sem ilustração (Filmes, "Em
 * breve", Assistir depois, Pausadas, Concluídas etc.) continuam
 * exatamente do tamanho de sempre, já que não passam `illustration`.
 */
export function EmptyShelf({ message, actionLabel, actionHref, illustration, subtitle, dividerLabel }: EmptyShelfProps) {
  // Só a variante "rica" (com ilustração) usa título maior/em negrito
  // — as outras 11 telas continuam com a mesma mensagem pequena e
  // discreta de sempre, sem essa mudança.
  const isRich = Boolean(illustration);

  return (
    // "Vidro" (toque leve — mantém a borda tracejada, ganha blur/gradiente translúcido em vez de `bg-surface/50` opaco).
    <div
      className={`flex flex-col items-center rounded-xl border border-dashed border-white/15 px-4 text-center backdrop-blur-[10px] backdrop-saturate-[160%] ${isRich ? "gap-4 py-10" : "gap-3 py-8"}`}
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.10), transparent 60%), rgba(255,255,255,0.04)",
      }}
    >
      {illustration}
      <p className={isRich ? "text-xl font-bold text-text" : "text-sm text-muted"}>{message}</p>
      {subtitle && (
        <p className={`max-w-[260px] leading-relaxed text-muted ${isRich ? "text-sm" : "text-xs"}`}>{subtitle}</p>
      )}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className={`mt-1 flex items-center gap-1.5 rounded-full border border-white/15 font-bold text-background shadow-lg transition-transform active:scale-95 ${isRich ? "px-8 py-3.5 text-base" : "px-6 py-3 text-sm"}`}
          style={{
            background: "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
          }}
        >
          <Plus className={isRich ? "h-5 w-5" : "h-4 w-4"} strokeWidth={2.75} />
          {actionLabel}
        </Link>
      )}
      {dividerLabel && (
        <div className="mt-2 flex w-full items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted/70">
          <span className="h-px flex-1 bg-white/10" />
          {dividerLabel}
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}
    </div>
  );
}
