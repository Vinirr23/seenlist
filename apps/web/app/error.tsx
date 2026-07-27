"use client";

import { useEffect } from "react";

/**
 * Error boundary do App Router (convenção especial do Next.js —
 * captura qualquer erro de renderização não tratado abaixo do layout
 * raiz). Achado real de auditoria: o projeto inteiro não tinha
 * NENHUM error boundary — um erro não tratado em qualquer componente
 * (um `undefined` inesperado, formato de resposta de API diferente
 * do esperado) deixava o usuário numa tela em branco, sem nenhuma
 * mensagem. Isso não previne o bug em si, só evita a tela morta —
 * a causa real continua precisando ser investigada e corrigida
 * quando aparecer (por isso o `console.error`, pra aparecer no
 * Vercel/no console do navegador).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-4xl">😕</p>
      <h1 className="text-lg font-semibold text-text">Algo deu errado</h1>
      <p className="max-w-sm text-sm text-muted">
        Não conseguimos carregar essa página. Tenta de novo — se continuar acontecendo, nos avisa pelo Feedback nas
        Configurações.
      </p>
      <button
        onClick={() => reset()}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        Tentar de novo
      </button>
    </div>
  );
}
