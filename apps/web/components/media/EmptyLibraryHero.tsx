"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";

export interface EmptyLibraryHeroProps {
  /** Caminho de uma imagem raster simples (`next/image`). Ignorado quando `illustrationNode` é passado. */
  illustrationSrc?: string;
  /**
   * Ilustração "rica" — um componente próprio (ex.: SVG inline animado)
   * no lugar da imagem raster simples. Ver `EmptyLibraryCouchScene.tsx`
   * pro único uso atual. Tem prioridade sobre `illustrationSrc` quando
   * os dois são passados.
   */
  illustrationNode?: ReactNode;
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
 *
 * AJUSTE FINO (2026-09-01, seguinte, a pedido — "aumentaria um pouco
 * a ilustração... subiria ligeiramente o bloco inteiro pra deixar
 * mais espaço entre o botão e 'Populares no SeenList'") — composição
 * já estava certa (usuário confirmou: "a composição agora está no
 * caminho certo"), só dois ajustes de medida: `w-[78%]/max-w-[340px]`
 * virou `w-[88%]/max-w-[380px]` (~13% maior, dentro da faixa "10-15%"
 * pedida — `aspect-[3/2]` continua garantindo que não corta/estica
 * nada, só escala). `pt-2` do container virou `pt-0` — sobe o bloco
 * inteiro um pouco (menos respiro ACIMA da ilustração); o respiro
 * ABAIXO (entre o divisor "OU" e "Populares no SeenList") não é deste
 * componente — ver `mt-6` → `mt-10` no wrapper de `PopularMediaRow`
 * em `MinhaListaSection.tsx`.
 *
 * TROCA DE ARTE + ANIMAÇÃO AMBIENTE (2026-09-01, seguinte, a pedido —
 * "quero transformar o empty state... numa animação premium,
 * extremamente sutil") — dois pedidos juntos, tratados com cuidado:
 *
 * 1) Imagem nova (`empty-library-scene.png`, luminária + gato dormindo
 *    + pipoca + planta): CONFERIDA pixel a pixel antes de trocar — ao
 *    contrário da anterior (objetos soltos em transparência quase
 *    total), esta tem uma "vinheta" oval que ocupa ~90% do canvas
 *    (só os 4 cantos são realmente transparentes); a cor de dentro
 *    bate perto do fundo do app, então funde bem na maior parte da
 *    tela, mas por baixo de uma das manchas azuis de `SeriesHome.tsx`
 *    o halo oval pode reaparecer sutilmente — AVISADO ao usuário
 *    (com composição sobre magenta pra provar) antes de trocar; ele
 *    escolheu usar assim mesmo.
 *
 * 2) Animação: o pedido original descrevia luminária, reflexo, gato,
 *    planta e manta como CAMADAS separadas de um SVG. Não existe tal
 *    SVG neste projeto — nem o anterior nem este são nada além de um
 *    PNG achatado, uma imagem só (conferido, não assumido). Avisado
 *    ao usuário; ele escolheu implementar agora só o que é possível
 *    SEM recortar a arte em camadas: (a) a ilustração inteira
 *    flutuando muito sutilmente (`.empty-hero-float`, ver
 *    `globals.css`) e (b) duas camadas SEPARADAS por CIMA da imagem,
 *    nunca dentro dela — um brilho suave posicionado sobre a lâmpada
 *    (`.empty-hero-glow`) e 3 partículas piscando em pontos vazios da
 *    cena (`.empty-hero-particle`), cada uma com seu próprio atraso/
 *    duração pra não sincronizar. Posições em `%` calculadas em cima
 *    do arquivo fonte 1536×1024 (bulbo da luminária: pico de brilho
 *    em ~31%/18% depois de um blur pra achar o centro real, não
 *    chute). Se a arte trocar de novo, essas posições precisam ser
 *    recalculadas.
 *
 * Tudo dentro de `prefers-reduced-motion: no-preference` (a pedido
 * explícito) — ver `globals.css`: com "Reduzir movimento" ativado,
 * as classes caem pros valores estáticos definidos fora da media
 * query (nada de animação, nada some).
 *
 * CSS puro (`transform`/`opacity`, mesmo padrão já usado em
 * `.feed-item-enter` do `globals.css`) — sem lib de animação nova,
 * sem JS/`requestAnimationFrame`, sem re-render do React: o navegador
 * compila essas duas propriedades direto na GPU.
 *
 * ANIMAÇÃO COMPLETA (2026-09-01, seguinte, a pedido — usuário enviou
 * `seenlist_sofa_true_vector.svg` e escolheu "tentar a animação
 * completa" mesmo sabendo do custo de performance) — a versão acima
 * (overlay de brilho/partículas em cima de uma imagem raster) foi
 * SUBSTITUÍDA pela `illustrationNode` nova (`EmptyLibraryCouchScene.tsx`,
 * um SVG inline de verdade com grupos animáveis: gato respirando,
 * planta balançando, manta se mexendo, luz da luminária pulsando,
 * 2 estrelinhas piscando) — ver o comentário completo desse arquivo
 * pro histórico. `illustrationSrc`/`<Image>` continua existindo aqui
 * como caminho simples pra qualquer FUTURO uso deste componente que
 * não precise de animação por elemento.
 */
export function EmptyLibraryHero({
  illustrationSrc,
  illustrationNode,
  title,
  subtitle,
  actionLabel,
  actionHref,
  dividerLabel,
}: EmptyLibraryHeroProps) {
  return (
    <div className="flex flex-col items-center px-2 pt-0 text-center">
      {/*
        * "aumentaria um pouco a ilustração — 10-15%" (a pedido,
        * 2026-09-01, seguinte) — era `w-[78%]/max-w-[340px]`, virou
        * `w-[88%]/max-w-[380px]` (~13% maior nos dois eixos, meio da
        * faixa pedida). `aspect-[3/2]` continua reproduzindo a
        * proporção exata do arquivo (1536×1024 = 1,5 = 3/2), então só
        * escala — não corta nem estica. `max-w-[380px]` só entra em
        * jogo no md/desktop (container já limitado a 430px ali) pra
        * não virar uma imagem gigante. SEM `style`/máscara nenhuma
        * aqui — o arquivo já é transparente de verdade (canal alfa
        * real), nada pra "fingir" mais.
        */}
      <div className="empty-hero-float relative -mb-3 aspect-[3/2] w-[88%] max-w-[380px]">
        {illustrationNode ??
          (illustrationSrc && (
            <Image src={illustrationSrc} alt="" fill sizes="380px" className="object-contain" priority />
          ))}
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
