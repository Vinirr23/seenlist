/**
 * A PEDIDO (2026-10-09 — redesign das páginas públicas, item 1:
 * classificação indicativa no hero, "opção A"). Decisão do usuário:
 * sem classificação BR cadastrada no TMDB, o selo não aparece — nunca
 * um texto tipo "Não informado" — por isso `certification` aceita
 * `null` e o componente devolve `null` nesse caso, sem renderizar
 * nada. "Visualmente discreta" (pedido) — texto pequeno, contorno
 * fino, sem cor de destaque — nunca compete com o título.
 */
export function CertificationBadge({ certification }: { certification: string | null }) {
  if (!certification) return null;

  return (
    <span className="rounded border border-muted/50 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-muted">
      {certification}
    </span>
  );
}
