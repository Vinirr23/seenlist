import Image from "next/image";
import Link from "next/link";

/**
 * TASK-XXX (2026-09-04) — pedaços compartilhados entre `LandingPage.tsx`
 * ("/") e `app/about/page.tsx` ("/about"): cabeçalho, rodapé, as
 * constantes de "vidro"/botão "geleia" (mesma receita usada em
 * `ProfileHeader.tsx`/`StatisticsCard.tsx`, não inventada aqui) e os
 * ícones de marca (nenhum lucide-react tem, conferido antes de usar
 * cada um): Google Play e Apple são os arquivos reais que o usuário
 * mandou (`public/google-play-mark.webp`, `public/apple-mark.png`);
 * Android, Instagram, TikTok e Threads são desenhados à mão (sem
 * arquivo oficial disponível neste ambiente). Extraído pra um arquivo
 * só depois que o rodapé passou a aparecer em duas páginas — repetir
 * o mesmo cabeçalho/rodapé em dois arquivos ia divergir com o tempo.
 */

export const GLASS_CARD =
  "rounded-2xl border border-white/10 backdrop-blur-md backdrop-saturate-150 shadow-lg shadow-black/20";
export const GLASS_CARD_BG = {
  background:
    "radial-gradient(75% 90% at 22% 12%, rgba(255,255,255,0.14), transparent 60%), rgba(255,255,255,0.06)",
};
export const GLASS_CHIP =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 backdrop-blur-[10px] backdrop-saturate-[160%]";
export const GLASS_CHIP_BG = {
  background:
    "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
};
export const GEL_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/15 text-background backdrop-blur-[10px] backdrop-saturate-[160%] transition-transform active:scale-[0.96]";
export const GEL_BUTTON_STYLE = {
  background:
    "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
};
/** Faixa sem scrollbar visível pras fileiras de pôster que rolam na horizontal (mobile). */
export const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
/** Classe pro efeito de hover nos dois botões "Criar conta" — ver `CtaHoverStyle`. */
export const CTA_HOVER_BLUE = "seenlist-cta-hover-blue";

/**
 * A PEDIDO (2026-09-04 — "ao invés dessa animação nos botões, faz com
 * que ao passar o mouse por cima, fique com o tom de azul que usamos
 * em 'em breve'") — troca a animação de brilho anterior por uma
 * mudança de cor no hover: o gradiente "geleia" âmbar
 * (`GEL_BUTTON_STYLE`) dá lugar, no hover/foco, a um gradiente
 * "geleia" na MESMA cor azul da cápsula ativa "Em breve" (não é a cor
 * secundária/teal do resto do design — é uma TERCEIRA cor, só usada
 * ali). Valores copiados exatamente de `components/media/HomeTabs.tsx`
 * (TASK-063, "azul pra 'Em breve', âmbar pra 'Minha Lista'"):
 * `radial-gradient(130% 170% at 28% 18%, rgba(90,165,235,0.9) 0%,
 * rgba(58,133,206,0.88) 42%, rgba(24,78,140,0.92) 100%)` +
 * `box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px
 * rgba(10,50,90,0.4)`.
 *
 * CORREÇÃO (a pedido — "ainda ficou um contorno âmbar, quero que
 * fique o contorno também azul") — a primeira versão só cobria o
 * MIOLO do botão (`inset: 0`, dentro da borda), então o anel
 * `border-white/15` do botão continuava sendo pintado (antes de
 * qualquer filho, inclusive este `::after`) por cima do gradiente
 * âmbar de base do `style` inline — como essa borda é translúcida,
 * ficava com um resquício amarelado por baixo dela o tempo todo,
 * hover ou não. Correção: o `::after` agora cobre também esse anel
 * (`inset: -1px`, `border-radius: inherit`) e ganha sua PRÓPRIA borda
 * branca translúcida por cima do azul — sem `overflow: hidden` no
 * container (não precisa mais recortar nada, não tem mais sweep
 * deslizando) o `-1px` não é cortado.
 *
 * Implementado como um `::after` cobrindo o botão inteiro, com
 * `opacity` 0→1 no hover/foco — não troca o `style` inline (que
 * continua sendo o gradiente âmbar de base), só sobrepõe. O
 * texto/ícone de cada botão precisa estar num elemento com `relative
 * z-10` por cima do `::after` (`z-index: 0`), senão o hover cobriria o
 * conteúdo. Renderizar UMA VEZ por página (perto do topo do `<main>`),
 * não uma vez por botão.
 */
export function CtaHoverStyle() {
  return (
    <style>{`
      .${CTA_HOVER_BLUE} { position: relative; }
      .${CTA_HOVER_BLUE}::after {
        content: "";
        position: absolute;
        inset: -1px;
        z-index: 0;
        border-radius: inherit;
        border: 1px solid rgba(255,255,255,0.15);
        background: radial-gradient(130% 170% at 28% 18%, rgba(90,165,235,0.9) 0%, rgba(58,133,206,0.88) 42%, rgba(24,78,140,0.92) 100%);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(10,50,90,0.4);
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: none;
      }
      .${CTA_HOVER_BLUE}:hover::after,
      .${CTA_HOVER_BLUE}:focus-visible::after {
        opacity: 1;
      }
      @media (prefers-reduced-motion: reduce) {
        .${CTA_HOVER_BLUE}::after { transition: none; }
      }
    `}</style>
  );
}

export function Header() {
  return (
    <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 sm:px-8">
      <Link href="/" className="flex items-center gap-2.5">
        <Image src="/logo.png" alt="SeenList" width={32} height={32} className="rounded-lg" priority />
        <span className="text-sm font-bold tracking-wide text-text">SeenList</span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-sm font-medium text-text/80 transition-colors hover:text-text">
          Entrar
        </Link>
        <Link
          href="/register"
          className={`${GEL_BUTTON} ${CTA_HOVER_BLUE} px-4 py-2 text-xs font-bold uppercase tracking-wide`}
          style={GEL_BUTTON_STYLE}
        >
          <span className="relative z-10">Criar conta</span>
        </Link>
      </div>
    </header>
  );
}

/** Exportado — `app/about/page.tsx` reaproveita a mesma lista na seção de contato, em vez de duplicá-la. */
export const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/seenlist.app", Icon: InstagramIcon },
  { label: "TikTok", href: "https://www.tiktok.com/@seenlistapp", Icon: TikTokIcon },
  { label: "Threads", href: "https://www.threads.net/@seenlist.app", Icon: ThreadsIcon },
];

/**
 * Selo "Google Play"/"App Store" — mesmo par usado em `MobileBadges`
 * (`LandingPage.tsx`) e agora aqui no rodapé de novo (a pedido —
 * "coloca no final novamente o badge"). Extraído pra não duplicar o
 * JSX das duas cópias.
 */
export function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Link
        href="https://play.google.com/store/apps/details?id=com.seenlist.app"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 rounded-xl border border-border bg-background px-4 py-2.5 transition-colors hover:border-primary/50"
      >
        <GooglePlayIcon className="h-5 w-5" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[9px] uppercase tracking-wide text-muted">Disponível no</span>
          <span className="text-xs font-bold text-text">Google Play</span>
        </span>
      </Link>
      <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/60 px-4 py-2.5 opacity-60">
        <Apple className="h-5 w-5" />
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[9px] uppercase tracking-wide text-muted">Em breve na</span>
          <span className="text-xs font-bold text-muted">App Store</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Rodapé — reformulado (2026-09-04, a pedido) nos moldes do rodapé do
 * Serializd (referência visual): logo + redes sociais + links à
 * esquerda, selos de loja à direita. Mudanças em cima da versão
 * anterior:
 * - Tirou "não afiliado, não certificado" (a pedido) — a frase
 *   completa continua de verdade em `/terms`, aqui fica só a
 *   atribuição curta.
 * - "Sobre" entrou ao lado de Privacidade/Termos, apontando pra
 *   `/about` (rota nova, pública — ver `middleware.ts`).
 * - Redes sociais reais (a pedido, com os 3 handles que o usuário
 *   passou): Instagram, TikTok, Threads.
 * - Selos de loja de volta aqui embaixo (a pedido).
 */
export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="SeenList" width={20} height={20} className="rounded-md" />
            <span className="text-xs font-semibold text-muted">© {new Date().getFullYear()} SeenList</span>
          </div>

          <div className="flex items-center gap-4">
            {SOCIAL_LINKS.map(({ label, href, Icon }) => (
              <Link
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-muted transition-colors hover:text-text"
              >
                <Icon className="h-5 w-5" />
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted lg:justify-start">
            <span>Dados de filmes e séries: TMDB</span>
            <Link href="/about" className="transition-colors hover:text-text">
              Sobre
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-text">
              Privacidade
            </Link>
            <Link href="/terms" className="transition-colors hover:text-text">
              Termos
            </Link>
          </div>
        </div>

        <StoreBadges className="flex-col items-center sm:flex-row lg:items-start" />
      </div>
    </footer>
  );
}

/**
 * Logo da Apple (App Store) — arquivo real (a pedido, 2026-09-04: "a
 * logo da play e store e da app store estão erradas, segue as
 * logos"), salvo em `public/apple-mark.png` (a maçã cinza, do jeito
 * que o usuário mandou), não mais um desenho à mão.
 */
export function Apple({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <Image src="/apple-mark.png" alt="" fill sizes="24px" className="object-contain" />
    </span>
  );
}

/**
 * Versão simplificada (só "cabeça" — antenas + olhos), desenhada à
 * mão no mesmo estilo de traço dos ícones do lucide-react (24×24,
 * `currentColor`, sem preenchimento) — o mascote "bugdroid" do Android
 * é do Google, licenciado em Creative Commons Attribution 3.0, e o
 * lucide-react não tem um ícone de marca pra ele (conferido antes de
 * desenhar: só existem `Smartphone`/`Phone`/`Bot`, nenhum é o robô).
 */
export function AndroidIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 11a7 7 0 0 1 14 0v6H5v-6Z" />
      <path d="m8.5 5.5-1.5-2M15.5 5.5l1.5-2" />
      <circle cx="9.5" cy="10.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="10.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Logo do Google Play (o triângulo de 4 cores) — arquivo real (a
 * pedido, 2026-09-04: "a logo da play e store e da app store estão
 * erradas, segue as logos"), salvo em `public/google-play-mark.webp`
 * (o mesmo arquivo que o usuário mandou), não mais um desenho à mão
 * — a primeira versão (reconstruída de memória, já que a rede deste
 * ambiente não deixa baixar de `raw.githubusercontent.com`/hosts
 * parecidos) tinha o formato errado.
 */
export function GooglePlayIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <Image src="/google-play-mark.webp" alt="" fill sizes="24px" className="object-contain" />
    </span>
  );
}

/**
 * Instagram — desenhado à mão (câmera arredondada + lente + flash),
 * mesmo raciocínio do Android/Google Play acima: sem instalar
 * biblioteca nova, e o lucide-react não tem mais esse ícone (foi
 * descontinuado — issue #2792 no repositório oficial deles).
 */
export function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * TikTok — desenhado à mão (a "nota musical": haste + cabeça
 * arredondada embaixo + laço/onda no topo). O lucide-react nunca
 * chegou a ter esse ícone (pedido em aberto, issue #2810/#2811 no
 * repositório deles) — reconstrução própria, não é o arquivo de
 * marca oficial pixel a pixel.
 */
export function TikTokIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className} aria-hidden="true">
      <path d="M15.5 3c.4 2.3 2 3.9 4.3 4.2v2.9c-1.6 0-3-.5-4.3-1.4v6.6a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3a2.7 2.7 0 1 0 1.9 2.6V3h2.9Z" />
    </svg>
  );
}

/**
 * Threads — desenhado à mão (o nó/laço duplo). É de longe o mais
 * difícil de reproduzir de memória dos 3 (o traço oficial é bem mais
 * orgânico/assimétrico) — essa é uma aproximação estilizada, não o
 * arquivo de marca oficial. Se não ficar parecido o suficiente, me
 * manda o SVG/PNG oficial (baixado do Meta Brand Resource Center) que
 * eu troco por esse aqui.
 */
export function ThreadsIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M8.5 8.2c0-2.8 1.8-4.7 4.4-4.7 3 0 4.9 2.3 4.9 6.3v.9c0 5.4-2.5 8.8-6.9 8.8-3.5 0-5.9-2-5.9-5 0-2.7 1.9-4.4 5.2-4.6 2.1-.1 3.6.3 4.6.9" />
      <path d="M13.9 11.8c0 1.7-1.1 2.8-2.7 2.8-1.3 0-2.1-.7-2.1-1.7 0-1.1 1-1.8 2.6-1.8.7 0 1.6.1 2.2.3" />
    </svg>
  );
}
