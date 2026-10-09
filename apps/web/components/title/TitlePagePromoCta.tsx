import Link from "next/link";
import Image from "next/image";
import { AppleMark } from "@/components/common/AppleMark";
import { GooglePlayIcon } from "@/components/landing/shared";

/**
 * REFORMULADO (2026-10-09 — redesign das páginas públicas, item 10:
 * "quero uma apresentação mais integrada ao design, sem aparência de
 * anúncio externo"). Antes era só um link discreto ("Marcar como
 * assistido, avaliar e acompanhar no SeenList" → `href`). Continua
 * cumprindo esse mesmo papel — o link "Já tenho conta" abaixo é
 * exatamente o `href` de antes, quem já tem sessão cai direto nela,
 * quem não tem cai no login normal via middleware e volta pra cá
 * depois — mas agora É o card "Monitore no app SeenList" pedido: logo
 * real do SeenList (nunca inventada — `public/logo.png`), proposta de
 * valor curta, e os dois botões de loja com os MESMOS ícone/URL reais
 * já usados em `MobileAppPromoBanner.tsx` (`AppleMark` — vetorial,
 * ver comentário lá sobre por que não é mais o PNG antigo —, e
 * `GooglePlayIcon`, de `components/landing/shared.tsx`). Sem pop-up,
 * sem autoplay — é um card de página normal, mesmo fundo/borda dos
 * outros cards da ficha técnica, não um anúncio de terceiro.
 */
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.seenlist.app";
const APP_STORE_URL = "https://apps.apple.com/app/seenlist-s%C3%A9ries-e-filmes/id6812850654";

export function TitlePagePromoCta({ href }: { href: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface/40 p-4 backdrop-blur-[18px] backdrop-saturate-[180%]">
      <div className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
        <h2 className="text-sm font-semibold text-text">Monitore no app SeenList</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Marque o que já assistiu, avalie com a sua galera e receba recomendações pensadas pro seu gosto — tudo isso só existe no app.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-xs font-semibold text-text hover:border-primary/40"
        >
          <AppleMark className="h-5 w-5 shrink-0 text-text" />
          Baixar na App Store
        </a>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-xs font-semibold text-text hover:border-primary/40"
        >
          <GooglePlayIcon className="h-5 w-5 shrink-0" />
          Baixar no Google Play
        </a>
      </div>

      <Link href={href} className="mt-3 inline-block text-xs font-medium text-muted underline-offset-2 hover:text-primary hover:underline">
        Já tenho conta — continuar no site
      </Link>
    </div>
  );
}
