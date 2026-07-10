"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PartyPopper } from "lucide-react";

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  color: string;
  rotation: number;
}

const CONFETTI_COLORS = ["#E8A33D", "#4FD1C5", "#34C77B", "#F0B429"];

function generateConfetti(count: number): ConfettiPiece[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 400,
    color: CONFETTI_COLORS[id % CONFETTI_COLORS.length] ?? "#E8A33D",
    rotation: Math.random() * 360,
  }));
}

export interface CelebrationScreenProps {
  showCount: number;
  episodeCount: number;
  favoriteCount: number;
  pendingCount?: number;
}

/**
 * Item 11, "OBRIGATÓRIA" — animação leve, sem biblioteca nova: só
 * ~40 divs caindo com CSS puro (`@keyframes` definido no
 * `tailwind.config.ts`, mesmo arquivo que já ganhou a animação do
 * toast). Confete + esta tela juntam o que os itens 10 e 11 pedem
 * (os dois mostram os mesmos números e levam pro mesmo lugar) — em
 * vez de duas telas quase idênticas em sequência, uma só, mais rica,
 * como o item 11 descreve.
 *
 * TASK-027.5 — `pendingCount` some as poucas séries ambíguas sem
 * bloquear nada: aparece como nota discreta com link pra resolver
 * quando o usuário quiser, nunca como pré-requisito pra continuar.
 */
export function CelebrationScreen({ showCount, episodeCount, favoriteCount, pendingCount = 0 }: CelebrationScreenProps) {
  const router = useRouter();
  const [confetti] = useState(() => generateConfetti(40));

  return (
    <div className="relative flex min-h-[80dvh] w-full flex-col items-center justify-center overflow-hidden px-6 text-center md:mx-auto md:max-w-[430px]">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {confetti.map((piece) => (
          <span
            key={piece.id}
            className="absolute top-0 h-2 w-2 rounded-sm animate-confetti-fall"
            style={{
              left: `${piece.left}%`,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}ms`,
              transform: `rotate(${piece.rotation}deg)`,
            }}
          />
        ))}
      </div>

      <PartyPopper className="h-12 w-12 text-primary" strokeWidth={1.5} />

      <h1 className="mt-4 text-2xl font-bold text-text">Bem-vindo ao SeenList!</h1>
      <p className="mt-2 text-sm text-muted">Sua biblioteca foi restaurada com sucesso.</p>

      <div className="mt-6 space-y-1.5 text-sm text-text">
        <p>📺 {showCount} séries importadas</p>
        <p>📺 {episodeCount.toLocaleString("pt-BR")} episódios restaurados</p>
        {favoriteCount > 0 && <p>❤️ {favoriteCount} favoritos encontrados</p>}
      </div>

      {pendingCount > 0 && (
        <p className="mt-4 text-xs text-muted">
          ⚠ {pendingCount} {pendingCount === 1 ? "série precisa" : "séries precisam"} da sua ajuda — resolva quando
          quiser em{" "}
          <a href="/import/tvtime/pending" className="text-primary underline">
            Pendências de importação
          </a>
          .
        </p>
      )}

      <p className="mt-6 text-sm text-muted">Sua jornada continua exatamente de onde parou.</p>

      <button
        type="button"
        autoFocus
        onClick={() => router.push("/series")}
        className="mt-8 w-full max-w-xs rounded-lg bg-primary py-3 text-sm font-semibold text-background transition-transform active:scale-[0.96]"
      >
        Começar a explorar
      </button>
    </div>
  );
}
