"use client";

import Image from "next/image";
import { useState } from "react";
import { Fraunces, Manrope } from "next/font/google";
import { ArrowRight, Check, Film } from "lucide-react";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-body",
});

type FormState = "idle" | "error" | "success";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Fita de furos de projetor (sprocket holes) — o mesmo motivo da
 * logo (fita de filme), usado como moldura decorativa no topo e no
 * rodapé em vez de um divisor genérico. É o "elemento de assinatura"
 * desta página: a única coisa propositalmente decorativa aqui,
 * o resto fica quieto.
 */
function FilmStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 ${className}`} aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-primary/25" />
      ))}
    </div>
  );
}

/**
 * TASK-069 — landing page de captação de e-mail pra beta fechada.
 * Fora dos grupos de rota (main)/(auth) de propósito: nem chrome de
 * app (sem barra de navegação inferior), nem cartão de auth — página
 * de marketing solta, própria, liberada como pública em
 * `middleware.ts` (`PUBLIC_ROUTES`), senão cairia direto na tela de
 * login pra quem ainda nem tem conta.
 *
 * SEM integração com Supabase ainda, como pedido — o formulário
 * valida o formato do e-mail no cliente e mostra sucesso/erro
 * simulado, só pra já entregar os DOIS estados visuais prontos.
 * Trocar por uma chamada de verdade depois é só substituir o corpo
 * de `handleSubmit`.
 */
export default function BetaPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>("idle");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!EMAIL_PATTERN.test(email.trim())) {
      setState("error");
      return;
    }

    // Placeholder: nenhuma chamada de rede acontece aqui ainda.
    setState("success");
  }

  return (
    <main
      className={`${display.variable} ${body.variable} relative flex min-h-dvh flex-col items-center overflow-hidden bg-background px-6 py-10`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Brilho ambiente atrás da logo — único acento de luz da página, nada mais compete com ele. */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-1/2 h-[320px] w-[520px] translate-x-1/2 rounded-full bg-secondary/10 blur-[110px]"
        aria-hidden="true"
      />

      <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center gap-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl shadow-[0_0_40px_-8px_rgba(232,163,61,0.55)]">
            <Image src="/logo.png" alt="SeenList" fill sizes="64px" priority />
          </div>
          <span className="text-sm font-semibold uppercase tracking-[0.3em] text-muted">SeenList</span>
        </div>

        {/* Título + subtítulo */}
        <div className="flex flex-col items-center gap-4 text-center">
          <FilmStrip />
          <h1
            className="text-4xl leading-[1.08] text-text sm:text-5xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            O sucessor do{" "}
            <span className="text-muted line-through decoration-2 decoration-muted/50">TV Time</span>{" "}
            está <em className="not-italic text-primary">chegando</em>.
          </h1>
          <p className="max-w-sm text-balance text-base leading-relaxed text-muted">
            SeenList é o app pra acompanhar tudo que você assiste — séries e filmes, episódio por
            episódio, num lugar só. Entra na lista e seja avisado assim que a beta abrir.
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} noValidate className="flex w-full flex-col gap-3">
          <label htmlFor="beta-email" className="sr-only">
            Seu e-mail
          </label>
          <input
            id="beta-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state !== "idle") setState("idle");
            }}
            aria-invalid={state === "error"}
            aria-describedby="beta-form-feedback"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-base text-text placeholder:text-muted/70 outline-none transition-colors focus:border-primary"
          />

          <button
            type="submit"
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-background transition-transform active:scale-[0.98]"
          >
            Entrar na beta
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
          </button>

          {/* Espaço reservado pra feedback — altura fixa, pra não empurrar o layout quando a mensagem aparece. */}
          <div id="beta-form-feedback" role="status" className="min-h-[3rem] px-1 pt-1">
            {state === "error" && (
              <p className="flex items-start gap-2 text-sm text-danger">
                <span aria-hidden="true">●</span>
                Digite um e-mail válido pra gente conseguir te avisar.
              </p>
            )}
            {state === "success" && (
              <p className="flex items-start gap-2 text-sm text-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} />
                Você está na lista! Avisamos assim que a beta abrir.
              </p>
            )}
          </div>
        </form>
      </div>

      <footer className="relative z-10 flex w-full max-w-md flex-col items-center gap-4 pt-6">
        <FilmStrip />
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Film className="h-3.5 w-3.5" strokeWidth={2} />
          SeenList — vagas limitadas na beta fechada
        </p>
      </footer>
    </main>
  );
}
