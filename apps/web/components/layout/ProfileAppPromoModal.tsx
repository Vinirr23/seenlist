"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { GooglePlayIcon } from "@/components/landing/shared";
import { AppleMark } from "@/components/common/AppleMark";

/**
 * A PEDIDO (2026-10-08, reportado — "quando alguém clica no link desse
 * banner [de compartilhar perfil] abre essa tela, mas não tem nada aí
 * tipo 'baixe o app'") — depois de corrigir a faixa fina ausente
 * (`MobileAppPromoBanner`, ver `app/u/[username]/page.tsx`), pedido
 * seguinte: além da faixa, um popup mais forte só na PRIMEIRA vez que
 * a página de perfil compartilhado abre — com mensagem + os dois
 * botões de loja, fecha com X e deixa navegar (decisão do usuário:
 * não bloqueia a tela).
 *
 * Reaproveita a MESMA chave de "já clicou instalar"
 * (`seenlist:app-promo-clicked-install`) que `MobileAppPromoBanner.tsx`
 * já usa — clicar numa loja aqui também esconde a faixa fina (e
 * vice-versa, clicar na faixa também esconde este popup em visitas
 * futuras): é o mesmo sinal de intenção real, não dois contadores
 * separados. O X só fecha ESTA visita (mesmo critério do X da faixa)
 * — recarregar a página mostra de novo, a não ser que a pessoa já
 * tenha clicado em alguma loja alguma vez.
 *
 * BUG REAL CORRIGIDO (2026-10-08, reportado — "no navegador interno do
 * Threads não aparece nem o popup nem a faixa") — `localStorage.getItem`
 * sem try/catch quebrava o efeito de montagem inteiro em navegadores
 * internos que bloqueiam `localStorage` (Threads/Instagram, modo de
 * prévia de link). Corrigido: se não der pra ler, o padrão passa a ser
 * mostrar o popup.
 *
 * REDESIGN "Refinado" (2026-10-08, a pedido, 3 mockups apresentados —
 * https://claude.ai/artifact/89Z1AZLEtBEuvyWnaNWw9h — usuário escolheu
 * a opção A e pediu ajustes sucessivos): logo (`/logo.png`) em destaque
 * no topo, frase de apoio nova, e os dois botões de loja viraram selos
 * completos — ícone + duas linhas de texto ("Baixar na" / "App Store",
 * "Disponível no" / "Google Play"). Ícone da Apple trocado por
 * `AppleMark` (SVG vetorial, ver comentário em
 * `components/common/AppleMark.tsx`) — o PNG antigo (`Apple`, de
 * `landing/shared.tsx`) era baixa resolução/cinza chapado, ficava
 * borrado no tamanho maior pedido.
 *
 * INVESTIGADO (2026-10-09, reportado — "o popup não aparece dentro do
 * navegador interno do Threads", mesmo depois da correção acima) —
 * diagnóstico temporário (removido depois de confirmar) mostrou o
 * componente funcionando perfeitamente: o efeito roda sem erro nenhum,
 * só que acha `seenlist:app-promo-clicked-install = "1"` já gravado
 * DENTRO do armazenamento daquele navegador interno específico — ou
 * seja, não é bug: é o mesmo comportamento esperado de "pessoa que já
 * clicou pra instalar não vê o popup de novo", só que a chave ficou
 * gravada ali de algum teste anterior (bem provável: durante a
 * validação da correção de 2026-10-08 citada acima). Nada a corrigir
 * no código — quem quiser ver o popup de novo nesse mesmo navegador
 * interno precisa limpar os dados do app (Threads/Instagram) pra
 * apagar esse armazenamento.
 */
const INSTALLED_KEY = "seenlist:app-promo-clicked-install";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.seenlist.app";
const APP_STORE_URL = "https://apps.apple.com/app/seenlist-s%C3%A9ries-e-filmes/id6812850654";

export function ProfileAppPromoModal() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    let clickedInstall = false;
    try {
      clickedInstall = localStorage.getItem(INSTALLED_KEY) === "1";
    } catch (error) {
      console.error("[ProfileAppPromoModal] localStorage indisponível, mostrando popup por padrão", error);
    }
    if (!clickedInstall) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function handleDismiss() {
    setMounted(false);
    setTimeout(() => setOpen(false), 200);
  }

  function handleStoreClick() {
    try {
      localStorage.setItem(INSTALLED_KEY, "1");
    } catch (error) {
      console.error("[ProfileAppPromoModal] Falha ao gravar preferência de instalação", error);
    }
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 transition-opacity duration-200 sm:items-center ${mounted ? "opacity-100" : "opacity-0"}`}
      onClick={handleDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-[22px] border border-white/10 bg-gradient-to-b from-surface to-background p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <button type="button" onClick={handleDismiss} aria-label={t("social.close")} className="text-muted">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="relative mx-auto -mt-2 mb-3.5 h-14 w-14 overflow-hidden rounded-2xl shadow-[0_10px_24px_-8px_rgba(232,163,61,0.35)]">
          <Image src="/logo.png" alt="SeenList" fill sizes="56px" className="object-cover" />
        </div>

        <p className="text-center text-base font-extrabold tracking-tight text-text">{t("social.profilePromoTitle")}</p>
        <p className="mt-1.5 text-center text-sm leading-relaxed text-muted">{t("social.profilePromoSubtitle")}</p>

        <div className="mt-5 flex items-center justify-center gap-2.5">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStoreClick}
            className="flex flex-1 items-center justify-center gap-3 rounded-xl border border-primary/30 bg-white/[0.03] px-3 py-3"
          >
            <AppleMark className="h-9 w-9 shrink-0 text-text" />
            <span className="flex flex-col leading-[1.15]">
              <span className="text-[9px] font-medium uppercase tracking-wide text-muted">{t("social.storeAppleSmall")}</span>
              <span className="text-sm font-extrabold text-text">{t("social.storeAppleBig")}</span>
            </span>
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleStoreClick}
            className="flex flex-1 items-center justify-center gap-3 rounded-xl border border-primary/30 bg-white/[0.03] px-3 py-3"
          >
            <GooglePlayIcon className="h-9 w-9 shrink-0" />
            <span className="flex flex-col leading-[1.15]">
              <span className="text-[9px] font-medium uppercase tracking-wide text-muted">{t("social.storeGoogleSmall")}</span>
              <span className="text-sm font-extrabold text-text">{t("social.storeGoogleBig")}</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
