"use client";

import { useEffect, useMemo, useState } from "react";

const COLORS = ["#E8A33D", "#4FD1C5", "#22c55e", "#a855f7", "#3b82f6", "#F4F1E8"];
const PARTICLE_COUNT = 40;
const DURATION_MS = 2600;

interface Particle {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  rotation: number;
  size: number;
}

/**
 * TASK-170 — confete em CSS puro (sem lib nova, a pedido). Cada
 * partícula é um `div` colorido caindo via `@keyframes` inline
 * (`<style jsx>` não existe fora de componentes de página no App
 * Router — usa uma tag `<style>` normal, com um nome de animação
 * único por partícula pra não colidir com outra instância se duas
 * chamadas coexistirem por acaso). Se desmonta sozinho depois da
 * duração — quem chama só precisa renderizar isto uma vez, sem
 * controlar timer nenhum.
 */
export function ConfettiBurst({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length]!,
        delay: Math.random() * 0.3,
        duration: 1.8 + Math.random() * 0.8,
        rotation: Math.random() * 360,
        size: 6 + Math.random() * 6,
      })),
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes seenlist-confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.9; }
        }
      `}</style>
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            backgroundColor: p.color,
            borderRadius: 2,
            animation: `seenlist-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
