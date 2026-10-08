"use client";

import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { GooglePlayIcon } from "@/components/landing/shared";
import { AppleMark } from "@/components/common/AppleMark";

/**
 * SIMPLIFICADO (2026-09-30, a pedido — "só aparece 'app store', quero
 * que o banner seja simples, com a frase: Disponível para Android e
 * iOS e os botões com os símbolos") — antes, em celular (Android/iOS),
 * este componente mostrava um MODAL CHEIO (tela inteira escurecida
 * atrás, cartão centralizado, título grande "Nunca mais perca um
 * episódio novo", lista de benefícios, 1 botão de TEXTO só pra loja
 * detectada pelo user-agent — por isso o print mandado só mostrava
 * "BAIXAR NA APP STORE": o usuário estava acessando de um iPhone).
 * Só o desktop tinha a faixa fina, não-bloqueante (`DesktopAppBanner`,
 * antes dentro deste mesmo arquivo).
 *
 * Decisão do usuário (perguntado diretamente: manter modal simplificado
 * vs. unificar com a faixa do desktop) — unificar: a MESMA faixa fina
 * que já existia só pro desktop agora vale pras 3 plataformas
 * (Android/iOS/desktop), sempre — nunca mais bloqueia a tela, mesmo
 * texto genérico ("Já disponível para Android e iOS",
 * `androidPromo.desktopBannerText`, já existente, reaproveitado) e os
 * dois botões com o símbolo oficial de cada loja — não depende mais
 * de detectar a plataforma pra decidir qual botão/texto mostrar,
 * mostra as duas sempre, deixando a pessoa escolher.
 *
 * Detecção de plataforma (user-agent, `Platform`) NÃO É MAIS
 * NECESSÁRIA — o conteúdo é idêntico nas 3. `INSTALLED_KEY` continua
 * do mesmo jeito de antes: clicar em qualquer um dos dois botões
 * marca "já clicou" e esconde a faixa PRA SEMPRE (não só nesta
 * visita); fechar pelo X esconde só nesta visita.
 *
 * As chaves de tradução do modal antigo (`androidPromo.titleLine1/2`,
 * `subtitle`, `featureNotifications*`, `featureFast`, `featureSync`,
 * `availableFor`, `cta`, `ctaIos`) ficaram sem uso — deixadas como
 * estão em `translations.ts` de propósito (não é este componente que
 * deve decidir apagar tradução; se quiser limpar depois, é só pedir).
 *
 * BUG REAL CORRIGIDO (2026-10-08, reportado — "no navegador interno
 * do Threads não aparece nem o popup nem a faixa") — mesma causa raiz
 * documentada em `ProfileAppPromoModal.tsx` (ler o comentário lá
 * primeiro): `localStorage.getItem(INSTALLED_KEY)` sem try/catch
 * quebrava o efeito de montagem inteiro em navegadores internos que
 * bloqueiam `localStorage` (Threads/Instagram, modo de prévia de
 * link), impedindo `setOpen(true)` de rodar. Corrigido com try/catch,
 * mesma regra: se não der pra ler, assume que a faixa deve aparecer.
 *
 * ÍCONE DA APPLE TROCADO POR SVG (2026-10-08, mesmo pedido/causa raiz
 * documentados em `ProfileAppPromoModal.tsx`/`AppleMark.tsx`) — o
 * `Apple` de `landing/shared.tsx` usa um PNG de baixa resolução/cinza
 * chapado; trocado por `AppleMark` (vetorial, sempre nítido).
 */
const INSTALLED_KEY = "seenlist:app-promo-clicked-install";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.seenlist.app";
const APP_STORE_URL = "https://apps.apple.com/app/seenlist-s%C3%A9ries-e-filmes/id6812850654";

export function MobileAppPromoBanner() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let clickedInstall = false;
    try {
      clickedInstall = localStorage.getItem(INSTALLED_KEY) === "1";
    } catch (error) {
      console.error("[MobileAppPromoBanner] localStorage indisponível, mostrando faixa por padrão", error);
    }
    if (!clickedInstall) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // SEM `localStorage` aqui de propósito — fechar (X) só esconde nesta
  // visita; a próxima carga da página mostra de novo.
  function handleDismiss() {
    setMounted(false);
    setTimeout(() => setOpen(false), 200);
  }

  // Clicar numa loja é um sinal real de intenção — esconde pra sempre,
  // igual o antigo `INSTALLED_KEY` do modal/faixa de desktop.
  function handleStoreClick() {
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch (error) {
      console.error("[MobileAppPromoBanner] Falha ao gravar preferência de instalação", error);
    }
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2.5 transition-opacity duration-200",
        mounted ? "opacity-100" : "opacity-0"
      )}
    >
      <Smartphone className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-text">{t("androidPromo.desktopBannerText")}</p>

      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleStoreClick}
        aria-label="App Store"
        className="flex shrink-0 items-center justify-center rounded-full border border-primary/30 p-1.5"
      >
        <AppleMark className="h-4 w-4 text-text" />
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleStoreClick}
        aria-label="Google Play"
        className="flex shrink-0 items-center justify-center rounded-full border border-primary/30 p-1.5"
      >
        <GooglePlayIcon className="h-4 w-4" />
      </a>

      <button type="button" onClick={handleDismiss} aria-label={t("social.close")} className="shrink-0 text-muted">
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
