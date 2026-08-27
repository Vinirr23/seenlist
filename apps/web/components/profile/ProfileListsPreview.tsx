"use client";

import Link from "next/link";
import Image from "next/image";
import { ListChecks, Plus, ChevronRight } from "lucide-react";
import { useMyListsWithPreview } from "@/lib/queries/lists";
import { tmdbImage } from "@/lib/tmdb/image";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-178 — "Minhas listas" ganha o efeito "baralho" (pôsteres
 * empilhados/levemente rotacionados) das referências trazidas antes
 * — cada lista vira um cartão com os pôsteres dela por trás do nome,
 * numa fileira horizontal (uma lista do lado da outra). Vazio segue
 * o mesmo padrão dos favoritos: convite pra criar a primeira.
 */
export function ProfileListsPreview() {
  const { data: lists, isLoading } = useMyListsWithPreview();
  const { t } = useTranslation();

  return (
    <section className="mb-6">
      {/*
       * CORREÇÃO (bug real, reportado com print — "não consigo entrar
       * nessa parte de criar nova lista") — este cabeçalho nunca foi
       * clicável: era um `<div>`/`<h2>` solto, sem `Link` nenhum.
       * Diferente dos outros 4 carrosséis do Perfil (Séries/Séries
       * favoritas/Filmes/Filmes favoritos, `ProfileMediaCarousel.tsx`),
       * que sempre envolveram ícone+título+seta inteiros num `Link`
       * pra tela cheia (`/profile/series` etc.) — só dava pra entrar
       * em "Minhas listas" tocando direto num pôster de lista já
       * existente (o que abre a lista específica, não a tela com
       * "Criar nova lista"). Corrigido replicando o MESMO padrão:
       * cabeçalho inteiro dentro de um `Link` pra `/profile/lists`,
       * com a mesma seta (`ChevronRight`) dos outros cabeçalhos.
       */}
      <Link href="/profile/lists" className="relative mb-2 flex items-center justify-between gap-2 px-1">
        <span className="relative flex items-center gap-2">
          {/*
           * Correção (achado real via console — getComputedStyle provou
           * que cor/sombra do texto aqui são IDÊNTICAS às de "Séries
           * favoritas" (que já lia certo); não era bug de CSS. O
           * "azulado" que sobrava era o brilho de fundo mais concentrado
           * perto do topo da página vazando por trás — este título é um
           * dos 2 mais perto do topo. Escurecido só o fundo, sem mexer
           * mais no texto/sombra (já corretos). Sem z-index (a mesma
           * armadilha de pintura já resolvida antes nesta tela) —
           * `relative` só pra entrar na mesma fase de pintura do ícone/
           * título seguintes, que ficam por cima por ordem no DOM.
           */}
          <div
            className="pointer-events-none absolute -inset-x-3 -inset-y-3 rounded-2xl blur-xl"
            style={{ background: "radial-gradient(closest-side, rgba(5,7,12,0.55), transparent 75%)" }}
            aria-hidden="true"
          />
          <ListChecks className="relative h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="relative text-base font-bold text-text [text-shadow:0_0_2px_rgba(0,0,0,0.9),0_0_5px_rgba(0,0,0,0.75),0_1px_6px_rgba(0,0,0,0.6)]">
            {t("profile.section.lists")}
          </h2>
        </span>
        <span className="shrink-0 text-muted">
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </Link>

      {isLoading ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto overflow-y-hidden px-4 pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 w-28 shrink-0 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : !lists || lists.length === 0 ? (
        <Link
          href="/profile/lists"
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/40 px-4 py-8 text-center transition-colors hover:border-primary/40"
        >
          <Plus className="h-6 w-6 text-muted" strokeWidth={2} />
          <p className="text-sm font-semibold text-text">{t("profile.createFirstList")}</p>
        </Link>
      ) : (
        <div className="-mx-4 flex gap-3 overflow-x-auto overflow-y-hidden px-4 pb-1">
          {lists.map((list) => (
            <Link key={list.id} href={`/profile/lists/${list.id}`} className="w-28 shrink-0">
              <div className="relative h-28 w-28">
                {list.previewPosters.length === 0 ? (
                  <div
                    className="flex h-full w-full items-center justify-center rounded-lg border border-white/10 backdrop-blur-[14px] backdrop-saturate-[180%]"
                    style={{
                      background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
                    }}
                  >
                    <ListChecks className="h-6 w-6 text-muted/40" strokeWidth={1.5} />
                  </div>
                ) : (
                  list.previewPosters.slice(0, 4).map((posterPath, index, arr) => {
                    const posterUrl = tmdbImage(posterPath, "w185");
                    // TASK-178 — index 0 é o item mais recente (a
                    // consulta já vem ordenada assim) — fica na
                    // frente (maior z-index, sem rotação); os de
                    // trás (mais antigos) ficam levemente girados,
                    // alternando o lado, tipo um baralho de verdade.
                    const zIndex = arr.length - index;
                    const rotation = index === 0 ? 0 : (index % 2 === 0 ? 1 : -1) * index * 4;
                    const translateY = index === 0 ? 0 : index * -3;
                    return (
                      // Correção (a pedido — "os cards vazios não estão com
                      // efeito vidro igual no mockup. deixei TODOS os cards
                      // com esse efeito") — o mockup (`.deck`) usa o MESMO
                      // vidro (borda + blur + gradiente) em TODO card de
                      // lista, tenha pôster carregado ou não; antes, aqui
                      // (quando a lista já tem itens) usávamos um card opaco
                      // (`border-border bg-background`, sem vidro nenhum) —
                      // só o card "lista sem nenhum item" (acima) tinha o
                      // vidro. Unificado: todo slot usa o mesmo vidro; o
                      // pôster (quando carrega) fica por cima, cobrindo a
                      // textura; quando não carrega, aparece o mesmo
                      // placeholder com ícone do card vazio.
                      <div
                        key={index}
                        className="absolute inset-0 overflow-hidden rounded-lg border border-white/10 shadow-md backdrop-blur-[14px] backdrop-saturate-[180%]"
                        style={{
                          transform: `translateY(${translateY}px) rotate(${rotation}deg)`,
                          zIndex,
                          background: "radial-gradient(70% 80% at 20% 15%, rgba(255,255,255,0.16), transparent 60%), rgba(255,255,255,0.09)",
                        }}
                      >
                        {posterUrl ? (
                          <Image src={posterUrl} alt="" fill sizes="112px" className="object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <ListChecks className="h-5 w-5 text-muted/40" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <p className="mt-1.5 truncate text-xs font-medium text-text">{list.name}</p>
              <p className="text-[11px] text-muted">
                {list.itemCount} {list.itemCount === 1 ? t("profile.item") : t("profile.items")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
