/**
 * A PEDIDO — refinamento da aba Sobre (série): "o layout atual parece
 * uma tabela, transforme em uma seção visual mais moderna" — de
 * `<dt>/<dd>` numa grade de texto puro pra card com fundo próprio,
 * ícone opcional e hierarquia clara (valor grande, rótulo pequeno
 * embaixo — não o contrário). Único lugar que usa isso é
 * `SeriesDetailsView.tsx`, então dá pra trocar a interface sem medo
 * de quebrar outra tela.
 */
export function MetaRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    // "Vidro" (mesmo padrão dos chips neutros do Explorar) — borda clara + blur/saturação em vez de `bg-surface` opaco.
    <div
      className="rounded-xl border border-white/10 px-3 py-2.5 backdrop-blur-[10px] backdrop-saturate-[160%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
      }}
    >
      {icon}
      <p className="truncate text-sm font-semibold text-text">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
