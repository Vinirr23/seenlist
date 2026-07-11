"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X, Rocket, Star, MessageSquare, Bot, ArrowUpRight } from "lucide-react";

const DISMISS_KEY = "seenlist:beta-banner-dismissed";

const FEATURES = [
  { icon: Rocket, label: "Acesso antecipado" },
  { icon: Star, label: "Novidades exclusivas" },
  { icon: MessageSquare, label: "Sua opinião faz a diferença" },
];

/**
 * TASK-071 (v2) — trocado de barra fina fixa no topo pra um pop-up
 * central de verdade (mesmo padrão de modal do `CreatePostButton`:
 * fundo escurecido + cartão centralizado), seguindo a referência
 * visual que o usuário mandou. `sessionStorage` — some ao fechar,
 * mas volta a aparecer na próxima vez que a pessoa abrir o app
 * ("assim que a pessoa loga", não "só uma vez pra sempre"). Como
 * agora é um overlay (não ocupa espaço no fluxo da página), não
 * empurra mais o conteúdo de nenhuma tela pra baixo — o problema que
 * tínhamos com a versão em barra (empurrar a capa do Perfil) não
 * existe mais nesta versão.
 */
export function BetaPromoBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(sessionStorage.getItem(DISMISS_KEY) !== "1");
  }, []);

  function handleDismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-primary/30 bg-surface p-6 shadow-[0_0_60px_-12px_rgba(232,163,61,0.4)]">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar aviso"
          className="absolute right-4 top-4 text-muted hover:text-text"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="mb-5 flex items-center gap-2">
          <div className="relative h-7 w-7 overflow-hidden rounded-lg">
            <Image src="/logo.png" alt="" fill sizes="28px" />
          </div>
          <span className="text-sm font-semibold lowercase tracking-wide text-text">seenlist</span>
        </div>

        <h2 className="text-3xl font-black leading-[1.05] text-text">
          Participe do
          <br />
          <span className="text-primary">nosso beta!</span>
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Ajude a melhorar o <span className="font-semibold text-text">SeenList</span> e tenha acesso
          antecipado às novidades.
        </p>

        <div className="mt-5 flex items-start justify-between gap-2">
          {FEATURES.map((feature) => (
            <div key={feature.label} className="flex flex-1 flex-col items-start gap-1.5">
              <feature.icon className="h-4 w-4 text-primary" strokeWidth={2} />
              <span className="text-[11px] leading-tight text-muted">{feature.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
          <Bot className="h-8 w-8 shrink-0 text-primary" strokeWidth={1.75} />
          <p className="text-xs text-muted">
            Beta disponível para
            <br />
            <span className="text-sm font-bold text-text">Android</span>
          </p>
        </div>

        <Link
          href="/beta"
          onClick={handleDismiss}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-extrabold uppercase tracking-wide text-background transition-transform active:scale-[0.98]"
        >
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
          Quero participar do beta
        </Link>
      </div>
    </div>
  );
}
