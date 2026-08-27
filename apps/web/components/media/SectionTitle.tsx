/**
 * No TV Time (ver referência), o rótulo de cada seção é um badge
 * cinza, em pílula, centralizado e maiúsculo — não um título comum
 * alinhado à esquerda. Reproduzido aqui assim, com o tamanho um
 * pouco maior pedido no refinamento (TASK-012).
 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex justify-center">
      {/* "Vidro" (mesmo padrão dos chips neutros do Explorar, GenreChips.tsx/ExploreTabs.tsx) — borda clara + blur/saturação + gradiente radial translúcido, em vez de `bg-surface` opaco. */}
      <span
        className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted backdrop-blur-[10px] backdrop-saturate-[160%]"
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
        }}
      >
        {children}
      </span>
    </div>
  );
}
