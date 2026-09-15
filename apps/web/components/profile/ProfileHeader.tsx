"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import type { CurrentUser } from "@/lib/queries/current-user";
import { useMyProfile } from "@/lib/queries/my-profile";
import { useFollowCounts } from "@/lib/queries/public-profile";
import { useSocialCounts } from "@/lib/queries/social-counts";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { Avatar } from "@/components/common/Avatar";
import { NotificationBell } from "./NotificationBell";
import { ProfileMoreSheet } from "./ProfileMoreSheet";

/**
 * "Vidro iluminado" (mockup-perfil-atual-vidro, 2026-08-21) — em vez
 * de um fundo translúcido uniforme, uma mancha de luz concentrada num
 * canto (não centralizada), como se o vidro estivesse pegando luz de
 * um lado só. `bg-white/10` sozinho não faz isso — por isso o
 * gradiente radial vai direto no `style` (Tailwind não tem utilitário
 * pra posicionar um radial-gradient assim sem ficar ilegível em
 * classe).
 */
const GLASS_ICON_BTN =
  "flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text shadow-lg shadow-black/25 backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90";
const GLASS_ICON_BTN_STYLE = {
  background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
};

/**
 * TASK-028 — ganhou username (@handle), banner, e os 3 contadores
 * (item 4 — "comentários" fica em 0 fixo, como a própria tarefa
 * autoriza: "podem permanecer zerados por enquanto", já que não
 * existe feature de comentário nenhuma ainda). Botão "Compartilhar
 * perfil" reaproveitado do componente já usado no perfil público.
 *
 * Tradução (4º lote) — inclui o formatador de data ("Membro desde"),
 * que antes ficava fixo em pt-BR mesmo com o idioma trocado.
 *
 * "Vidro iluminado" (ajuste, a pedido — "nome/@/membro desde não
 * estão ao lado da foto de perfil") — antes, quando existia capa, o
 * avatar ficava sobreposto na borda de baixo da capa (estilo
 * Twitter/Instagram) e o nome vinha numa linha separada abaixo. O
 * mockup aprovado usa avatar e nome LADO A LADO na mesma linha — a
 * capa continua existindo (a pedido: "capa e avatar é pra
 * continuar"), só não tem mais o avatar encavalado nela: o avatar
 * entrou na mesma linha do nome, a linha ficou uma só, reaproveitada
 * tanto pra quem tem capa quanto pra quem não tem.
 *
 * REVERTIDO (2026-09-03, a pedido — "retira o 'membro desde' do
 * perfil, e coloque os dados ao lado da foto de perfil, igual está no
 * mobile", depois de eu ter feito a mesma mudança no mobile primeiro
 * e avisado que isso desfazia a "ENTREGA 10" abaixo) — a "ENTREGA 10"
 * (ver ela mais abaixo, mantida como histórico) tinha justamente
 * mudado de "lado a lado" pra "nome numa linha própria ABAIXO do
 * avatar" quando existe capa, a pedido de um print de referência na
 * época. Pedido novo e explícito reverte só essa parte de novo — nome
 * volta a ficar do LADO do avatar mesmo com capa — E remove "Membro
 * desde" de vez (as duas mudanças a pedido, não é engano). O `bio`
 * abaixo continua igual (não fazia parte do pedido).
 */
export function ProfileHeader({ user }: { user: CurrentUser }) {
  const { data: profile } = useMyProfile();
  const { data: counts } = useFollowCounts(user.id);
  const { data: socialCounts } = useSocialCounts();
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);

  const statPills = [
    { href: "/profile/following", value: counts?.following ?? 0, label: t("profile.following") },
    { href: "/profile/followers", value: counts?.followers ?? 0, label: t("profile.followers") },
    { href: "/profile/comments", value: socialCounts?.commentsGiven ?? 0, label: t("profile.comments") },
  ];

  return (
    // CORREÇÃO (a pedido, 2026-08-26 — "tudo deve ser padronizado e
    // alinhado", auditoria proativa depois do bug das manchas cobrindo
    // texto no Perfil público) — igual ao `PublicProfileView.tsx`
    // (CAUSA RAIZ #4 lá), o texto nome/@/membro desde/bio abaixo não
    // tinha nenhum `position`/`backdrop-blur` (nenhum gatilho de
    // contexto de empilhamento) — a camada de manchas de fundo
    // (`position: absolute` em `ProfileView.tsx`) pintaria por CIMA
    // dele, não atrás, exatamente como acontecia no perfil público.
    // Adicionado `relative` aqui (sem nenhum offset — não muda
    // posição nenhuma, só entra no grupo certo de empilhamento) pra
    // cobrir todo o bloco de uma vez, sem precisar mexer em cada
    // parágrafo individualmente. Não confirmado com print de verdade
    // (diferente do perfil público, que teve print) — corrigido de
    // qualquer forma, por auditoria proativa do mesmo padrão de bug,
    // já que a receita é idêntica.
    <div
      className={
        profile?.bannerUrl
          ? "relative mb-6"
          : "relative mb-6 -mx-4 -mt-4 px-4 pt-4 pb-2 bg-gradient-to-b from-primary/[0.09] via-transparent to-transparent sm:rounded-t-lg"
      }
    >
      {profile?.bannerUrl && (
        /*
         * REDESENHO "CAPA CURTA E MINIMALISTA" (a pedido — "implementa
         * essa mudança no web", 2026-09-16, portando pro web o
         * redesenho feito primeiro no mobile — `profile.tsx`, versão F
         * do mockup de 6 variações mandado antes, "F- Capa curta e
         * minimalista" — com os dois ajustes que vieram depois lá:
         * avatar/nome subidos 30% do tamanho do próprio avatar, e a
         * correção de uma "sombra estranha" trocando véu+degradê
         * separados por UM gradiente contínuo só).
         *
         * Troca a capa de 224px (`h-56`) + avatar sobreposto 32px PRA
         * FORA da borda de baixo (`-bottom-8`, histórico da "ENTREGA 8"
         * mantido só nesta nota) por: capa bem mais baixa (190px, MESMO
         * valor do mobile), com um véu escuro que vira gradualmente a
         * cor de fundo da tela ANTES do fim da capa — a foto só ocupa
         * os 164px de cima (190 − 26); os 26px finais já são fundo
         * LISO, sem foto nenhuma atrás, e é nessa faixa que avatar+nome
         * ficam apoiados. Como agora tudo fica DENTRO da capa (nada
         * sobra por baixo dela), não precisa mais reservar espaço extra
         * (`mb-14`) pra fileira — só o respiro padrão (`mb-6`, mesmo
         * `spacing.lg` do mobile) antes da bio.
         */
        <div className="relative mb-6">
          <div className="relative -mx-4 h-[190px] w-[calc(100%+2rem)] overflow-hidden rounded-b-lg bg-background">
            {/* Só os 164px de cima têm foto — o resto (26px) já é o `bg-background` do `<div>` pai, aparecendo por baixo. */}
            <div className="absolute inset-x-0 top-0 h-[164px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- banner externo, sem domínio fixo pra configurar em next/image */}
              <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
              {/*
                * CAUSA RAIZ da "sombra estranha" (achada primeiro no
                * mobile, comparando print pixel a pixel) — DUAS camadas
                * empilhadas (véu chapado cobrindo a foto inteira + um
                * degradê separado só embaixo) liam como um degrau/sombra
                * dura, não uma transição suave. Aqui já nasce como UM
                * `bg-gradient-to-b` só, do véu (`rgba(11,14,20,0.38)`)
                * no topo até `bg-background` (mesma cor da faixa lisa
                * logo abaixo) embaixo — uma rampa contínua.
                */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgba(11,14,20,0.38)] to-background" aria-hidden="true" />

              <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                <NotificationBell />
                <button type="button" onClick={() => setShowMore(true)} aria-label={t("profile.moreOptions")} className={GLASS_ICON_BTN} style={GLASS_ICON_BTN_STYLE}>
                  <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/*
              * Avatar 66px (menor que os 74px do caso SEM capa, mesma
              * proporção do mobile `SHORT_HEADER_AVATAR_SIZE`) + nome/@
              * apoiados na faixa lisa de baixo, subidos 20px (30% do
              * tamanho do avatar: 66 × 0,3 = 19,8 ≈ 20) da borda —
              * `inset-x-4` reaproveita a borda de tela padrão de 16px
              * (a capa em si é edge-to-edge via `-mx-4`, o conteúdo por
              * cima dela respeita a borda normal).
              */}
            <div className="absolute inset-x-4 bottom-5 flex items-center gap-2">
              {/* Anel fino translúcido (1px, sem sombra/brilho ao redor) — mais discreto que o anel de vidro do caso SEM capa, combinando com a proposta minimalista da versão F. */}
              <div className="relative h-[66px] w-[66px] shrink-0 rounded-full border border-[rgba(255,255,255,0.5)]">
                {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — foto quebrada agora cai pras iniciais. */}
                <Avatar src={user.avatarUrl} name={user.name} className="h-full w-full bg-surface" textClassName="text-lg" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold text-text">{user.name}</p>
                {profile?.username && <p className="truncate text-sm text-primary">@{profile.username}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {!profile?.bannerUrl && (
        <div className="flex items-center justify-between pb-2">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setShowMore(true)}
            aria-label={t("profile.moreOptions")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:text-text"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}

      {/*
        * Só roda mais pro caso SEM capa — o caso COM capa (que passou
        * pelas "ENTREGA 8/9/10" descritas no topo do arquivo, depois
        * revertido de novo em 2026-09-03) agora se resolve inteiro
        * dentro do bloco `{profile?.bannerUrl && (...)}`  acima, junto
        * com o avatar (mesma fileira, ver comentário lá).
        */}
      {!profile?.bannerUrl && (() => {
        const nameBlockContent = (
          <>
            <p className="truncate text-lg font-bold text-text">{user.name}</p>
            {profile?.username && <p className="truncate text-sm text-primary">@{profile.username}</p>}
          </>
        );

        return (
          // AJUSTE (2026-09-03 — mesmo motivo do bloco COM capa acima:
          // avatar +15% e `gap-4`→`gap-2` pra "juntar mais" o nome/@ da
          // foto, igual valor já usado no mobile).
          <div className="flex items-center gap-2">
            {/*
             * Ajuste (a pedido, "tira o brilho ao redor da foto de perfil
             * e ajusta ela pra cima um pouco pra ficar uns 20% dentro da
             * capa") — removido o halo desfocado (conic-gradient +
             * blur-lg) que ficava atrás do avatar; mantido só o anel de
             * vidro (borda + reflexo) mais colado à foto.
             */}
            <div className="relative h-[74px] w-[74px] shrink-0">
              <div
                className="absolute -inset-0.5 rounded-full border border-white/40 shadow-[0_4px_18px_rgba(0,0,0,0.35)] backdrop-blur-md backdrop-saturate-150"
                style={{
                  background: "radial-gradient(65% 65% at 28% 22%, rgba(255,255,255,0.3), transparent 60%), rgba(255,255,255,0.10)",
                }}
                aria-hidden="true"
              />
              {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — foto quebrada agora cai pras iniciais. */}
              <Avatar src={user.avatarUrl} name={user.name} className="relative h-full w-full bg-surface" textClassName="text-lg" />
            </div>

            <div className="min-w-0">{nameBlockContent}</div>
          </div>
        );
      })()}

      {profile?.bio && <p className="mt-4 text-sm text-text">{profile.bio}</p>}

      <div className="mt-4 flex gap-2.5">
        {statPills.map((pill, index) => (
          <Link
            key={pill.href}
            href={pill.href}
            className="flex-1 rounded-2xl border border-white/10 px-1.5 py-3 text-center backdrop-blur-md transition-colors hover:border-primary/40"
            style={{
              background:
                index === statPills.length - 1
                  ? "radial-gradient(75% 90% at 22% 12%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(70% 90% at 85% 100%, rgba(42,127,184,0.22), transparent 60%), rgba(255,255,255,0.10)"
                  : "radial-gradient(75% 90% at 22% 12%, rgba(255,255,255,0.18), transparent 60%), rgba(255,255,255,0.10)",
            }}
          >
            <p className="text-sm font-bold text-text">{pill.value}</p>
            <p className="text-xs text-muted">{pill.label}</p>
          </Link>
        ))}
      </div>

      {showMore && <ProfileMoreSheet username={profile?.username} onClose={() => setShowMore(false)} />}
    </div>
  );
}
