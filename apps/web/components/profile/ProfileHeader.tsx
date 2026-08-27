"use client";

import Link from "next/link";
import { Settings, Pencil } from "lucide-react";
import type { CurrentUser } from "@/lib/queries/current-user";
import { useMyProfile } from "@/lib/queries/my-profile";
import { useFollowCounts } from "@/lib/queries/public-profile";
import { useSocialCounts } from "@/lib/queries/social-counts";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { ShareProfileButton } from "@/components/social/ShareProfileButton";
import { Avatar } from "@/components/common/Avatar";

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
 */
export function ProfileHeader({ user }: { user: CurrentUser }) {
  const { data: profile } = useMyProfile();
  const { data: counts } = useFollowCounts(user.id);
  const { data: socialCounts } = useSocialCounts();
  const { t, locale } = useTranslation();
  const joinDateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: "long", year: "numeric" });
  const joinDate = joinDateFormatter.format(new Date(user.createdAt));

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
        // ENTREGA 8 (a pedido, 2026-08-26 — comparação com o web
        // publicado, ver comentário completo em `PublicProfileView.tsx`
        // pra o porquê de cada medida/técnica) — capa de 176px (h-44)
        // virou 224px (h-56, medido no print real do publicado); o
        // avatar (antes só no `flex` abaixo, sem sobrepor nada) ganhou
        // de volta uma sobreposição na borda de baixo da capa — mas
        // como IRMÃO da capa (não filho dela), pra não ser cortado pelo
        // `overflow-hidden` que ela precisa ter pros cantos
        // arredondados. Botões editar/compartilhar/config continuam
        // dentro da capa (não fazem parte do que overflow corta, ficam
        // na área visível).
        <div className="relative mb-4">
          <div className="relative -mx-4 h-56 w-[calc(100%+2rem)] overflow-hidden rounded-b-lg bg-surface shadow-lg shadow-black/30">
            {/* eslint-disable-next-line @next/next/no-img-element -- banner externo, sem domínio fixo pra configurar em next/image */}
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" aria-hidden="true" />

            <div className="absolute inset-x-3 top-3 flex items-center justify-between">
              <Link href="/profile/edit" aria-label={t("profile.edit")} className={GLASS_ICON_BTN} style={GLASS_ICON_BTN_STYLE}>
                <Pencil className="h-4 w-4" strokeWidth={2} />
              </Link>
              <div className="flex gap-2">
                {profile?.username && <ShareProfileButton username={profile.username} iconOnly />}
                <Link href="/profile/settings" aria-label={t("settings.title")} className={GLASS_ICON_BTN} style={GLASS_ICON_BTN_STYLE}>
                  <Settings className="h-4 w-4" strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-8 left-0 h-16 w-16">
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
        </div>
      )}

      {!profile?.bannerUrl && (
        <div className="flex justify-end gap-2 pb-2">
          {profile?.username && <ShareProfileButton username={profile.username} iconOnly />}
          <Link
            href="/profile/settings"
            aria-label={t("settings.title")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:text-text"
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      )}

      {(() => {
        const nameBlockContent = (
          <>
            <p className="truncate text-lg font-bold text-text">{user.name}</p>
            {profile?.username && <p className="truncate text-sm text-primary">@{profile.username}</p>}
            <p className="text-xs text-muted">{t("profile.memberSince", { date: joinDate })}</p>
          </>
        );

        // ENTREGA 10 (a pedido, 2026-08-26 — ver comentário completo em
        // `PublicProfileView.tsx`, mesma receita replicada aqui) — depois
        // de 2 rodadas tentando alinhar avatar+nome LADO A LADO (Entregas
        // 8 e 9), o usuário mandou um print de referência e pediu "copie
        // esse estilo": nome numa linha PRÓPRIA, ABAIXO do avatar — não
        // mais do lado. Resolve o alinhamento pela raiz (não tem mais
        // nenhuma tentativa de centralizar o texto contra o avatar, então
        // não tem como desalinhar) E a legibilidade em capas claras (o
        // texto nunca mais chega perto da capa, só do fundo sólido do
        // card, então nunca corre risco de ficar ilegível numa foto
        // clara). Avatar continua irmão da capa (ver Entrega 8 pro
        // motivo). `pt-10` (40px) dá o mesmo respiro testado no perfil
        // público.
        if (profile?.bannerUrl) {
          return <div className="min-w-0 pt-10">{nameBlockContent}</div>;
        }

        return (
          <div className="flex items-center gap-4">
            {/*
             * Ajuste (a pedido, "tira o brilho ao redor da foto de perfil
             * e ajusta ela pra cima um pouco pra ficar uns 20% dentro da
             * capa") — removido o halo desfocado (conic-gradient +
             * blur-lg) que ficava atrás do avatar; mantido só o anel de
             * vidro (borda + reflexo) mais colado à foto.
             */}
            <div className="relative h-16 w-16 shrink-0">
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

      {!profile?.bannerUrl && (
        <div className="mt-3 flex gap-2">
          {/*
           * Correção (a pedido — "deixe todos os botões padrão, igual
           * 'ver detalhes'") — era contorno âmbar simples (`border-primary
           * bg-transparent text-primary`); virou a mesma pílula "gel"
           * (borda clara + blur/saturação + gradiente radial âmbar +
           * texto preto maiúsculo) do "Ver detalhes" (StatisticsCard.tsx).
           */}
          <Link
            href="/profile/edit"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wide text-background backdrop-blur-[10px] backdrop-saturate-[160%] transition-transform active:scale-[0.96]"
            style={{
              background:
                "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
            }}
          >
            {t("profile.edit")}
          </Link>
        </div>
      )}
    </div>
  );
}
