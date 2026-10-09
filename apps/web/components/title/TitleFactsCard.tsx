/**
 * A PEDIDO (2026-10-09 — redesign das páginas públicas, item 9:
 * "ficha técnica... sidebar no desktop... exibir apenas dados
 * existentes"). Componente de SERVIDOR, genérico — cada página (filme
 * ou série) monta sua própria lista de `rows` com os dados que já tem
 * (`MovieInfo.tsx`/grid solto de `MetaRow` que a série usava antes
 * foram substituídos por este único cartão, usado pelas duas), e o
 * cartão só decide a apresentação. Linhas com valor vazio/nulo nunca
 * chegam aqui — cada chamador já filtra antes (ver `page.tsx` de
 * filme/série) — "exibir apenas dados existentes" é responsabilidade
 * de quem monta `rows`, não deste componente.
 */
export interface TitleFactRow {
  label: string;
  value: string;
}

export function TitleFactsCard({ rows }: { rows: TitleFactRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/40 p-4 backdrop-blur-[18px] backdrop-saturate-[180%]">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted">Ficha técnica</h3>
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-[11px] uppercase tracking-wide text-muted">{row.label}</dt>
            <dd className="mt-0.5 text-sm leading-snug text-text">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
