"use client";

import { useId } from "react";

/**
 * A PEDIDO (2026-09-29) — "selo de verificação" (blue check / golden
 * check). Selo de 8 pontas (não círculo — decisão explícita do
 * usuário após ver os dois no mockup), sempre depois do nome, nunca
 * antes. Dimensionado em `1em` de propósito: herda o tamanho da
 * fonte do texto ao lado em cada contexto (cabeçalho de perfil ~18px,
 * linha de lista ~14px, comentário/post ~13px) em vez de exigir uma
 * prop de tamanho manual em cada call site.
 *
 * Visual aprovado no mockup https://claude.ai/artifact/HuSom21Ch3roVNDjR3EneC
 * ("perfeito") — não alterar cores/forma sem confirmar com o usuário.
 */

export type VerifiedTier = "gold" | "blue" | null | undefined;

interface VerifiedBadgeProps {
  tier: VerifiedTier;
  className?: string;
}

const SEAL_POINTS =
  "50,2 64.5,14.9 83.9,16.1 85.1,35.5 98,50 85.1,64.5 83.9,83.9 64.5,85.1 50,98 35.5,85.1 16.1,83.9 14.9,64.5 2,50 14.9,35.5 16.1,16.1 35.5,14.9";
const CHECK_POINTS = "28,52 43,67 74,33";

export function VerifiedBadge({ tier, className }: VerifiedBadgeProps) {
  // `useId()` precisa ser chamado incondicionalmente (regra dos hooks) —
  // mesmo quando o componente vai retornar null logo abaixo.
  const rawId = useId();

  if (tier !== "gold" && tier !== "blue") return null;

  const gradientId = `verified-gold-${rawId}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.1em] ${className ?? ""}`}
      aria-label={tier === "gold" ? "Conta oficial verificada" : "Conta verificada"}
      role="img"
    >
      {tier === "gold" && (
        <defs>
          <linearGradient id={gradientId} x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#7a5420" />
            <stop offset="28%" stopColor="#f6dd91" />
            <stop offset="50%" stopColor="#caa04a" />
            <stop offset="72%" stopColor="#fdf0bd" />
            <stop offset="100%" stopColor="#8a6425" />
          </linearGradient>
        </defs>
      )}
      <polygon
        points={SEAL_POINTS}
        fill={tier === "gold" ? `url(#${gradientId})` : "#2B90F0"}
        stroke={tier === "gold" ? "rgba(255,232,180,0.65)" : undefined}
        strokeWidth={tier === "gold" ? 1.2 : undefined}
      />
      <polyline
        points={CHECK_POINTS}
        fill="none"
        stroke={tier === "gold" ? "#8a6425" : "#ffffff"}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
