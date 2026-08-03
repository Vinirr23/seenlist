/**
 * No TV Time (ver referência), o rótulo de cada seção é um badge
 * cinza, em pílula, centralizado e maiúsculo — não um título comum
 * alinhado à esquerda. Reproduzido aqui assim, com o tamanho um
 * pouco maior pedido no refinamento (TASK-012).
 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex justify-center">
      <span className="rounded-full bg-surface px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        {children}
      </span>
    </div>
  );
}
