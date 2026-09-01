"use client";

import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";

export interface EmptyLibraryHeroProps {
  illustrationSrc: string;
  title: string;
  subtitle?: string;
  actionLabel: string;
  actionHref: string;
  dividerLabel?: string;
}

/**
 * A PEDIDO (2026-09-01 — "implemente o empty state igual ao mockup de
 * referência, sem transformar a ilustração em um card ou quadro...
 * não use sombra, bordas tracejadas ou efeito de quadro... o SVG
 * precisa ter fundo transparente... use position absolute ou layout
 * equivalente pra que a arte se misture ao background") — componente
 * NOVO, criado pra substituir o uso de `EmptyShelf` só nesse caso
 * específico (Séries/Home vazia). Motivo: `EmptyShelf` é, por
 * definição, um CARTÃO — borda tracejada + fundo "vidro" translúcido
 * envolvendo tudo (ver `EmptyShelf.tsx`, revertido de volta pra
 * versão simples/só-texto de sempre, já que esse era o único chamador
 * "rico"). O pedido é o oposto: ilustração e texto soltos,
 * DIRETAMENTE em cima do fundo da Home, sem nenhum retângulo/caixa
 * visível atrás dos dois.
 *
 * ACHADO REAL, causa raiz do "ainda parece quadro" (2026-09-01,
 * pedido anterior já tinha tentado só tirar a borda/sombra do
 * wrapper, sem resolver de verdade) — `SeriesHome.tsx` pinta um
 * campo de manchas azuis desfocadas ATRÁS de todo o conteúdo
 * (padrão "vidro", ver o `<div aria-hidden>` lá, blobs em
 * top: 40px/280px/520px/740px/950px). Ou seja, o fundo REAL atrás
 * deste componente não é a cor sólida `--color-background` — é essa
 * cor sólida + manchas azuis por cima, variando conforme a posição
 * na tela. A ilustração (arquivo .jpg, sem canal alfa) só bate com a
 * cor sólida pura; numa posição em que uma mancha azul passa por
 * trás dela, o retângulo da imagem volta a aparecer, só que agora
 * mais sutil (por isso ficou "quase certo, mas ainda meio quadro").
 *
 * NOTA IMPORTANTE — o usuário mencionou ter anexado
 * "seenlist-empty-state.svg" (um SVG de fundo transparente de
 * verdade). Conferi: o arquivo que de fato chegou aqui é
 * byte-a-byte IDÊNTICO (mesmo hash) ao .jpg opaco que eu já tinha
 * processado da vez anterior — o SVG não chegou a ser recebido nesta
 * sessão. Sem um arquivo com canal alfa de verdade em mãos, a
 * correção aplicada foi via CSS `mask-image` (gradiente radial:
 * opaco no centro, transparente nas bordas) diretamente no wrapper
 * da imagem — isso força transparência REAL nas bordas no navegador,
 * independente do fundo por trás (mancha azul, cor sólida ou
 * qualquer outra coisa) ser combinado com a cor do arquivo ou não.
 * Resultado equivalente a um PNG/SVG com alfa, sem precisar de um
 * arquivo novo. Se a pessoa mandar o SVG de verdade depois, é só
 * trocar `illustrationSrc` — o resto (tamanho, posição, hierarquia)
 * continua igual.
 */
export function EmptyLibraryHero({
  illustrationSrc,
  title,
  subtitle,
  actionLabel,
  actionHref,
  dividerLabel,
}: EmptyLibraryHeroProps) {
  return (
    <div className="flex flex-col items-center px-2 pt-2 text-center">
      {/*
        * "75-80% da tela" (a pedido) — `w-[78%]` do container (que já
        * corresponde à largura útil da tela no mobile — `SeriesHome.tsx`
        * só tem `px-2` de respiro). `aspect-[5/4]` reproduz exatamente
        * a proporção do arquivo original (700×560 = 1,25 = 5/4), então
        * a imagem cresce/encolhe sem cortar nem esticar nada.
        * `max-w-[340px]` só entra em jogo no md/desktop (container já
        * limitado a 430px ali) pra não virar uma imagem gigante.
        */}
      <div
        className="relative -mb-3 aspect-[5/4] w-[78%] max-w-[340px]"
        style={{
          // Transparência real nas bordas via máscara CSS — ver
          // comentário completo acima. Centro opaco (a cena inteira
          // aparece), some suavemente a partir da metade do raio.
          WebkitMaskImage: "radial-gradient(ellipse at 50% 45%, black 58%, transparent 96%)",
          maskImage: "radial-gradient(ellipse at 50% 45%, black 58%, transparent 96%)",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }}
      >
        <Image src={illustrationSrc} alt="" fill sizes="340px" className="object-contain" priority />
      </div>

      <p className="text-xl font-bold text-text">{title}</p>
      {subtitle && <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-muted">{subtitle}</p>}

      <Link
        href={actionHref}
        className="mt-5 flex items-center gap-1.5 rounded-full border border-white/15 px-8 py-3.5 text-base font-bold text-background shadow-lg transition-transform active:scale-95"
        style={{
          background:
            "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
        }}
      >
        <Plus className="h-5 w-5" strokeWidth={2.75} />
        {actionLabel}
      </Link>

      {dividerLabel && (
        <div className="mt-6 flex w-full items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted/70">
          <span className="h-px flex-1 bg-white/10" />
          {dividerLabel}
          <span className="h-px flex-1 bg-white/10" />
        </div>
      )}
    </div>
  );
}
