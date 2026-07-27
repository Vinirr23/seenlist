"use client";

/**
 * Versão do error boundary que cobre o pior caso: um erro dentro do
 * próprio `app/layout.tsx` (o `error.tsx` normal não cobre isso —
 * convenção do Next.js exige um arquivo à parte, que precisa montar
 * `<html>`/`<body>` do zero, já que ele SUBSTITUI o layout raiz
 * inteiro quando aciona).
 *
 * Estilo inline de propósito aqui (única exceção deliberada à
 * convenção de sempre usar classes Tailwind/tokens do tema) — esta
 * tela precisa continuar legível mesmo se o motivo do erro for algo
 * que impediria o CSS do resto do app de carregar certo.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, backgroundColor: "#0B0E14", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 36, margin: 0 }}>😕</p>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#F4F1E8", margin: 0 }}>Algo deu errado</h1>
          <p style={{ maxWidth: 380, fontSize: 14, color: "#8C93A8", margin: 0 }}>
            Não conseguimos carregar o SeenList agora. Tenta recarregar a página.
          </p>
          <button
            onClick={() => reset()}
            style={{
              borderRadius: 9999,
              backgroundColor: "#E8A33D",
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              color: "#0B0E14",
              border: "none",
              cursor: "pointer",
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
