/**
 * A PEDIDO (2026-09-15 — "implementa o esqueleton 3 Shimmer, tanto no
 * mobile quanto no web") — peça base do formato "fantasma" escolhido
 * pelo usuário numa prévia comparativa (4 opções: pontinhos, fantasma
 * corrigido, shimmer, respiração do cartão inteiro) pra substituir os
 * "pontinhos" do `HomeSkeleton.tsx` e os blocos estáticos (sem nenhuma
 * animação) do `EmBreveSkeleton` local de `series-home/EmBreveSection.tsx`.
 *
 * Mesmo conceito visual do `Skeleton.tsx` do mobile (ver comentário
 * completo lá, incluindo a causa raiz do bug original): base num tom
 * claro translúcido FIXO (`bg-white/[0.07]`, nunca preso a nenhum token
 * de fundo — por isso não pode coincidir com o fundo de nenhum
 * contêiner) + um brilho varrendo da esquerda pra direita por cima, em
 * loop (`animate-shimmer-sweep`, `tailwind.config.ts`).
 */
export function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded bg-white/[0.07] ${className}`} aria-hidden="true">
      <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/[0.16] to-transparent" />
    </div>
  );
}
