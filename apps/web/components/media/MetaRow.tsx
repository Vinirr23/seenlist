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
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      {icon}
      <p className="truncate text-sm font-semibold text-text">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
