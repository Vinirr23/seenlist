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
 * RESOLVIDO NA RAIZ DE VERDADE (2026-09-01, seguinte — "identifiquei
 * o problema: o SVG possui um fundo próprio... nenhum <rect>
 * cobrindo toda a área") — a tentativa anterior (`seenlist-empty-state.svg`)
 * nunca chegou de fato (era byte-a-byte idêntica ao .jpg opaco já
 * processado antes — ver histórico completo em `MinhaListaSection.tsx`),
 * então a correção daquela vez foi uma máscara CSS (gradiente radial)
 * pra FINGIR transparência nas bordas, já que o arquivo real não
 * tinha canal alfa nenhum.
 *
 * Desta vez o arquivo que chegou é DIFERENTE de verdade — conferido
 * pixel a pixel antes de usar (não assumido): PNG real, modo RGBA,
 * 1536×1024, canto a canto com alfa **0** (100% transparente) e o
 * sofá/pipoca/planta/halo com alfa alto (~253) — ou seja, JÁ vem sem
 * nenhum "rect de fundo", exatamente o que foi pedido. Composto por
 * cima de magenta pra confirmar visualmente (nenhuma borda
 * retangular aparece, só os objetos da cena) antes de integrar.
 * Como a transparência agora é REAL (do próprio arquivo), a máscara
 * CSS da vez anterior foi REMOVIDA — não é mais necessária, e
 * mantê-la só arriscaria cortar a imagem de um jeito redundante/
 * errado por cima de uma transparência que já está certa.
 *
 * Arquivo salvo em `public/illustrations/empty-library-couch.png`
 * (PNG, não .jpg — JPEG não tem canal alfa, perderia a transparência
 * na conversão). Redimensionado de 1536×1024 pra 768×512 (mesma
 * proporção 3:2, sem cortar/distorcer); o .jpg anterior (sem
 * transparência) fica órfão — ver comandos git no fim da entrega.
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
        * só tem `px-2` de respiro). `aspect-[3/2]` reproduz exatamente
        * a proporção do arquivo atual (1536×1024 = 1,5 = 3/2), então
        * a imagem cresce/encolhe sem cortar nem esticar nada.
        * `max-w-[340px]` só entra em jogo no md/desktop (container já
        * limitado a 430px ali) pra não virar uma imagem gigante. SEM
        * `style`/máscara nenhuma aqui — o arquivo já é transparente de
        * verdade (canal alfa real), nada pra "fingir" mais.
        */}
      <div className="relative -mb-3 aspect-[3/2] w-[78%] max-w-[340px]">
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
