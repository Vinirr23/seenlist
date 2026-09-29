"use client";

import { useEffect, useState } from "react";
import { X, Smartphone, Bell, Zap, RefreshCw, ArrowUpRight } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * RENOMEADO de `AndroidAppPromoBanner.tsx` (2026-09-24, a pedido —
 * "estende agora" pro iOS, já que o app "SeenList: Séries e Filmes"
 * saiu de verdade na App Store nesta sessão, confirmado por instalação
 * de terceiro). Histórico de antes da renomeação:
 *
 * A PEDIDO — substitui o antigo `BetaPromoBanner` (removido antes
 * nesta sessão): aquele convidava pra fase fechada de teste; este
 * anuncia que o app já está disponível pra valer na Play Store.
 * Mesma estrutura visual de card central, adaptada — sem "beta" em
 * lugar nenhum, com link real pra Play Store.
 *
 * MUDANÇA (2026-09-24) — a detecção de plataforma virou
 * `isAndroid || isIOS` (antes só `isAndroid`). Loja/link/texto do CTA
 * dependem da plataforma detectada (`STORE_URL`/`ctaKey` por
 * `platform`).
 *
 * MUDANÇA DE ESCOPO (2026-09-29, a pedido — "toda vez que um usuário
 * carregue o link pelo web, aparece aquele aviso de 'já disponível
 * para Android e iOS'", confirmado em 3 rodadas de pergunta: pra quem
 * mostrar, com que frequência, em que formato):
 *
 * 1. AGORA MOSTRA PRA DESKTOP TAMBÉM — antes, `platform === null`
 *    (nem Android nem iOS detectado) fazia o componente inteiro
 *    devolver `null`, sem nada visível pra quem acessa do computador.
 *    Detecção virou uma união de 3 valores (`"android" | "ios" |
 *    "desktop"`), sempre resolvendo pra algum dos três, nunca `null`.
 *
 * 2. SEM MEMÓRIA DE DISPENSA — a versão anterior guardava
 *    `DISMISS_KEY`/`DISMISS_DAYS` (7 dias) no `localStorage`: fechar o
 *    aviso escondia ele por uma semana. Removido de propósito, a
 *    pedido explícito ("toda vez", confirmado mesmo depois de eu
 *    apontar o trade-off de UX) — fechar (`X`) agora só esconde pra
 *    ESTA visita; a próxima carga da página mostra de novo. Única
 *    exceção: `INSTALLED_KEY` continua permanente — quem já CLICOU
 *    pra instalar não tem motivo pra continuar vendo o convite pra
 *    instalar.
 *
 * 3. DOIS FORMATOS DIFERENTES, NÃO UM SÓ — confirmado explicitamente
 *    ("ambos", quando perguntado se o modal cheio ainda serve depois
 *    de aparecer toda visita): mobile (Android/iOS) continua com o
 *    MODAL CHEIO de sempre (interrompe, mas leva direto pra loja —
 *    ação real possível). Desktop ganhou uma FAIXA FINA, sem bloquear
 *    a tela (`DesktopBanner`, abaixo) — a pessoa não instala ali na
 *    hora, só fica sabendo que o app existe; um modal bloqueando toda
 *    visita pra quem não pode agir seria só irritação pura.
 */
const INSTALLED_KEY = "seenlist:app-promo-clicked-install";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.seenlist.app";
const APP_STORE_URL = "https://apps.apple.com/app/seenlist-s%C3%A9ries-e-filmes/id6812850654";

type Platform = "android" | "ios" | "desktop";

export function MobileAppPromoBanner() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent;
    const isAndroid = /android/i.test(userAgent);
    // Detecção padrão de iOS via user agent — inclui iPad que pede
    // versão desktop (reporta "MacIntel" na plataforma, mas com touch
    // habilitado), caso comum em iPad moderno.
    const isIOS = /iphone|ipad|ipod/i.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const detectedPlatform: Platform = isAndroid ? "android" : isIOS ? "ios" : "desktop";

    const clickedInstall = localStorage.getItem(INSTALLED_KEY) === "1";
    if (!clickedInstall) {
      setPlatform(detectedPlatform);
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // SEM `localStorage` aqui de propósito (ver comentário grande acima,
  // item 2) — fechar só esconde nesta visita; a próxima carga da
  // página mostra de novo.
  function handleDismiss() {
    setMounted(false);
    setTimeout(() => setOpen(false), 200);
  }

  if (!open || !platform) return null;

  if (platform === "desktop") {
    return <DesktopAppBanner mounted={mounted} onDismiss={handleDismiss} />;
  }

  const storeUrl = platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
  const ctaLabel = platform === "ios" ? t("androidPromo.ctaIos") : t("androidPromo.cta");

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 transition-opacity duration-200",
        mounted ? "opacity-100" : "opacity-0"
      )}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "relative w-full max-w-sm rounded-2xl border border-primary/30 bg-surface p-6 shadow-[0_0_60px_-12px_rgba(232,163,61,0.4)] transition-all duration-200 ease-out",
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        )}
      >
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t("social.close")}
          className="absolute right-4 top-4 text-muted"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>

        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-background">
            <Smartphone className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <span className="text-sm font-semibold text-text">seenlist</span>
        </div>

        <h2 className="text-2xl font-extrabold leading-tight text-text">
          {t("androidPromo.titleLine1")}
          <br />
          <span className="text-primary">{t("androidPromo.titleLine2")}</span>
        </h2>
        <p className="mt-2 text-sm text-muted">{t("androidPromo.subtitle")}</p>

        {/*
          * O aviso de episódio novo saiu de um ícone pequeno no meio
          * e virou o destaque: é o benefício que só o app entrega, e
          * a explicação mais provável pra diferença de retenção
          * (36% com app vs 4% sem, medido no Android). Os outros dois
          * viraram linha secundária — continuam verdade, mas não são
          * o motivo de alguém instalar.
          */}
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
          <div>
            <p className="text-sm font-bold text-text">{t("androidPromo.featureNotifications")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t("androidPromo.featureNotificationsDetail")}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
            {t("androidPromo.featureFast")}
          </span>
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
            {t("androidPromo.featureSync")}
          </span>
        </div>

        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => localStorage.setItem(INSTALLED_KEY, "1")}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-extrabold uppercase tracking-wide text-background transition-transform active:scale-[0.98]"
        >
          {ctaLabel}
          <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
        </a>
      </div>
    </div>
  );
}

/**
 * Faixa fina pra quem acessa pelo DESKTOP — ver item 3 do comentário
 * grande em `MobileAppPromoBanner`, acima. Diferente do modal: não usa
 * `position: fixed`/overlay, fica no FLUXO normal do layout, logo no
 * topo, antes do conteúdo da tela — empurra o conteúdo pra baixo uns
 * poucos pixels, mas nunca bloqueia nada. Os dois links de loja aqui
 * são só informativos (quem clica no computador só abre a página da
 * loja no navegador, não instala nada ali) — por isso marcam
 * `INSTALLED_KEY` do mesmo jeito que o modal do celular: é um sinal
 * real de intenção, mesmo vindo do desktop.
 */
function DesktopAppBanner({ mounted, onDismiss }: { mounted: boolean; onDismiss: () => void }) {
  const { t } = useTranslation();

  function handleStoreClick() {
    localStorage.setItem(INSTALLED_KEY, "1");
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2.5 transition-opacity duration-200",
        mounted ? "opacity-100" : "opacity-0"
      )}
    >
      <Smartphone className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
      <p className="min-w-0 flex-1 truncate text-xs font-medium text-text">{t("androidPromo.desktopBannerText")}</p>

      {/*
        * Nome de loja ("App Store"/"Google Play") em texto FIXO, sem
        * chave de tradução — são nomes próprios de marca, iguais nos 3
        * idiomas do app (mesmo raciocínio de não traduzir "Android"/
        * "iOS" em lugar nenhum do resto do código). O rótulo mais
        * longo ("Baixar na App Store", `androidPromo.ctaIos`) é do
        * MODAL do celular, de propósito mais chamativo — aqui na
        * faixa fina, com dois botões lado a lado num espaço estreito
        * (coluna de ~430px, ver `TASK-014` em `app/(main)/layout.tsx`),
        * o nome curto sozinho já deixa claro que é link de loja.
        */}
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleStoreClick}
        className="shrink-0 whitespace-nowrap rounded-full border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-text"
      >
        App Store
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleStoreClick}
        className="shrink-0 whitespace-nowrap rounded-full border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-text"
      >
        Google Play
      </a>

      <button type="button" onClick={onDismiss} aria-label={t("social.close")} className="shrink-0 text-muted">
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
