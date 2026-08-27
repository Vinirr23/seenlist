"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { usePublicProfile, useFollowCounts } from "@/lib/queries/public-profile";
import { usePublicStats } from "@/lib/queries/public-stats";
import { FollowButton } from "./FollowButton";
import { ShareProfileButton } from "./ShareProfileButton";
import { PublicMediaSectionsList } from "./PublicMediaSectionsList";
import { StatsCarousel } from "@/components/profile/StatsCarousel";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";
import { PageError } from "@/components/media/PageError";
import { Avatar } from "@/components/common/Avatar";

/**
 * TASK-028 — página pública em `/u/[username]`. Item 11: só o
 * cabeçalho (via `usePublicProfile`, uma linha só da tabela
 * `profiles`) carrega de imediato; biblioteca e favoritos são
 * componentes à parte que só buscam quando realmente renderizam
 * (React Query lazy por natureza — não precisou de nenhuma técnica
 * especial de lazy-loading além de "não chamar o hook mais cedo").
 *
 * Não sabemos o nome/avatar de quem é dono do perfil sem outra
 * fonte — `profiles` não guarda nome nem foto (isso mora em
 * `auth.users`, que não é publicamente consultável por design do
 * Supabase). Por isso o cabeçalho usa o username como identificação
 * principal; nome/foto completos só aparecem quando é o PRÓPRIO
 * usuário vendo a própria página pública (via `useCurrentUser`).
 *
 * ENTREGA 5 (a pedido, 2026-08-26 — "foto de perfil, capa, nomes e
 * etc... deixe igual no perfil do usuário") — até aqui, o
 * cabeçalho (capa + avatar + nome) tinha sido escrito do zero, sem
 * seguir a receita real de `ProfileHeader.tsx` (Perfil próprio):
 * avatar SOBREPOSTO na borda de baixo da capa (estilo antigo,
 * Instagram/Twitter) em vez de avatar ao LADO do nome; sem o anel de
 * vidro (borda + reflexo + blur) no avatar; capa sem cantos
 * arredondados embaixo, sem sombra, sem o degradê de leitura na
 * borda inferior; sem o fundo âmbar sutil quando não tem capa. Tudo
 * isso já tinha sido corrigido no Perfil próprio faz tempo (ver
 * comentário de `ProfileHeader.tsx`, "nome/@/membro desde não estão
 * ao lado da foto de perfil") — só nunca tinha sido replicado aqui.
 *
 * Reescrito o bloco de cabeçalho pra seguir a MESMA estrutura de
 * `ProfileHeader.tsx`, quase cópia exata (avatar+nome lado a lado
 * numa `flex` só, anel de vidro no avatar, capa com `rounded-b-lg` +
 * sombra + degradê de leitura, fundo âmbar sutil com cantos
 * arredondados quando não tem capa). Duas diferenças deliberadas,
 * confirmadas lendo o código real antes de decidir (não adivinhadas):
 *
 * 1. O truque `-mx-4 -mt-4` do Perfil próprio (bleed pra fora do
 *    padding da página) só funciona porque `/profile/page.tsx` já
 *    envolve tudo num `<div className="px-4">` — aqui não existia
 *    esse wrapper (o `/u/[username]/page.tsx` renderiza direto, sem
 *    padding nenhum). Pra funcionar igual, o `px-4` que antes só
 *    existia no meio do componente (depois da capa) subiu pro
 *    container mais externo — agora a estrutura de camadas bate
 *    exatamente com a real: página com `px-4` → `<div
 *    className="relative">` sem padding → bloco do cabeçalho com
 *    `-mx-4` pra sangrar de volta até a borda.
 * 2. O `-mt-4` do Perfil próprio NÃO foi copiado aqui: conferido
 *    `app/(main)/layout.tsx` e `app/(main)/profile/page.tsx` — nenhum
 *    dos dois tem `pt-*`, ou seja, não existe nenhum espaço vertical
 *    de verdade pra esse `-mt-4` estar cancelando ali (mistério que
 *    fica registrado, não decifrado — não impede a réplica). Como
 *    `/u/[username]/page.tsx` roda no layout raiz (`app/layout.tsx`,
 *    sem `(main)`) e não tem NENHUM `pt-*` conhecido pra cancelar
 *    também, copiar um `-mt-4` "porque sim" arriscava empurrar o
 *    conteúdo pra cima demais sem necessidade — decisão: só copiar o
 *    que tem justificativa confirmada (o `-mx-4`, que sangra a capa
 *    até a borda da tela) e deixar de fora o que não tem (o `-mt-4`).
 *
 * A linha "país + ingressou em" (informação que só existe no perfil
 * PÚBLICO — o Perfil próprio não mostra país nenhum) ocupa o mesmo
 * lugar/estilo da linha "Membro desde" do Perfil próprio (terceira
 * linha, ao lado do avatar, texto pequeno e apagado) — não virou uma
 * linha solta separada como estava antes.
 */
/**
 * BUG REAL CORRIGIDO (2026-08-27, reportado — "quando entro no perfil
 * de alguém que eu sigo, não tem uma seta pra voltar") — causa raiz:
 * esta tela nunca teve NENHUM mecanismo de voltar (nem `Link` fixo,
 * nem `router.back()`), desde que foi criada — não é regressão desta
 * sessão. Confirmado comparando com toda tela parecida do app (`grep`
 * por `ArrowLeft`/`router.back` em todos os componentes): telas com UM
 * destino fixo de origem (ex.: "Minha Lista") usam `SectionPageHeader`
 * (`Link` fixo pra `/profile`); telas de detalhe alcançáveis de VÁRIOS
 * lugares diferentes (Filme, Série — `MovieHeader.tsx`/
 * `SeriesHeader.tsx`) usam `router.back()` — a categoria certa aqui,
 * já que o perfil público é aberto de vários lugares (avaliação,
 * comentário, lista de seguidores/seguindo, busca, explorar). Um
 * `Link` fixo (ex.: sempre `/profile`) levaria pro perfil ERRADO
 * (o do próprio usuário, não de quem ele estava vendo) quando aberto
 * de qualquer lugar que não seja a aba Perfil. Botão replicado com o
 * mesmo desenho de vidro de `MovieHeader.tsx`/`SeriesHeader.tsx`
 * (círculo flutuante sobre a capa/topo da tela, sem depender de
 * nenhum wrapper de página — por isso plugado direto no `<div
 * className="relative w-full px-4 ...">` mais externo: como esse `div`
 * já é quem aplica o `px-4` da tela toda, um filho `absolute` conta a
 * padding-box dele como referência, e por isso `left-3`/`top-3`
 * encostam na borda de verdade da tela — nenhuma sangria extra
 * (`-mx-4`) é necessária aqui, diferente do resto do cabeçalho).
 */
export function PublicProfileView({ username }: { username: string }) {
  const router = useRouter();
  const { data: profile, isLoading, isError, refetch } = usePublicProfile(username);
  const { data: currentUser } = useCurrentUser();
  const { data: counts } = useFollowCounts(profile?.userId ?? null);
  const statsQuery = usePublicStats(profile?.userId ?? null);
  const { t, locale } = useTranslation();
  const joinDateFormatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { month: "long", year: "numeric" });

  const backButton = (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label={t("common.back")}
      className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-text shadow-lg shadow-black/25 backdrop-blur-md backdrop-saturate-150 transition-transform active:scale-90"
      style={{
        background: "radial-gradient(70% 75% at 25% 20%, rgba(255,255,255,0.26), transparent 65%), rgba(255,255,255,0.10)",
      }}
    >
      <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );

  if (isLoading) {
    return (
      <div className="relative w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
        {backButton}
        <div className="h-28 animate-pulse rounded-lg bg-surface" />
        <div className="mt-4 h-6 w-40 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="relative w-full md:mx-auto md:max-w-[430px]">
        {backButton}
        <PageError message={t("social.errorLoadProfile")} onRetry={() => refetch()} />
      </div>
    );
  }

  // `null` cobre tanto "não existe" quanto "existe mas é privado" de
  // propósito — a RLS já filtra isso, e não queremos revelar qual
  // dos dois casos é (ver comentário em usePublicProfile).
  if (!profile) {
    notFound();
  }

  const isOwnProfile = currentUser?.id === profile.userId;
  // Correção de investigação — antes, só o dono via o nome/avatar de
  // verdade, porque a única fonte existente (user_metadata) nunca foi
  // pública via RLS. Agora que profiles.display_name/avatar_url
  // existem e SÃO lidos com a mesma policy de visibilidade da própria
  // página, qualquer pessoa autorizada a ver o perfil vê o nome/foto
  // reais — não só o username.
  const displayName = profile.displayName?.trim() || `@${profile.username}`;
  const avatarUrl = profile.avatarUrl;

  const statPills = [
    { value: counts?.following ?? 0, label: t("profile.following") },
    { value: counts?.followers ?? 0, label: t("profile.followers") },
    { value: 0, label: t("profile.comments") },
  ];

  const joinedLine = [
    profile.country,
    t("social.joinedOn", { date: joinDateFormatter.format(new Date(profile.createdAt)) }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative w-full px-4 pb-24 md:mx-auto md:max-w-[430px]">
      {backButton}
      {/*
       * "Vidro" (redesign âmbar/vidro, perfil público, 2026-08-26) —
       * mesmo campo de manchas azuis desfocadas do Perfil próprio
       * (ver ProfileView.tsx pro histórico completo das 3 causas-raiz
       * já investigadas: posição em pixel fixo não porcentagem, sem
       * z-index, sem overflow-hidden nesta camada). Concentradas na
       * faixa onde agora existem cards de vidro de verdade
       * (cabeçalho → pílulas de estatística → Estatísticas →
       * Favoritas → Biblioteca) — sem se estender além do conteúdo
       * real da tela pública, que é mais curta que o Perfil próprio.
       *
       * CAUSA RAIZ #4, DESTA TELA ESPECIFICAMENTE (achada a pedido do
       * usuário, 2026-08-26, depois que a correção de `text-shadow`
       * sozinha não resolveu "as manchas [continuam] cobrindo") — um
       * elemento `position: absolute` (como esta camada de manchas)
       * SEMPRE pinta por CIMA de qualquer irmão-depois-dele que não
       * tenha nenhum `position` definido — mesmo estando ANTES no
       * HTML — porque elemento posicionado sai do fluxo normal de
       * pintura e só respeita a ordem do HTML quando comparado com
       * OUTROS elementos também posicionados. Fix: o `<div
       * className="relative">` logo abaixo (que envolve todo o resto
       * do conteúdo) entra no mesmo grupo de "elementos posicionados"
       * desta camada — e aí sim a ordem do HTML (ele vem depois)
       * garante que pinte por cima.
       */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]"
          style={{ top: "120px", left: "-22%", background: "#1B4B7A" }}
        />
        <div
          className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]"
          style={{ top: "340px", right: "-20%", background: "#2A7FB8" }}
        />
        <div
          className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]"
          style={{ top: "560px", left: "-18%", background: "#0D3B5C" }}
        />
        <div
          className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]"
          style={{ top: "800px", right: "-18%", background: "#2A7FB8" }}
        />
        <div
          className="absolute h-48 w-48 rounded-full opacity-28 blur-[60px]"
          style={{ top: "1050px", left: "-16%", background: "#1B4B7A" }}
        />
        <div
          className="absolute h-40 w-40 rounded-full opacity-18 blur-[60px]"
          style={{ top: "1300px", right: "-14%", background: "#0D3B5C" }}
        />
      </div>

      <div className="relative">
        {/*
         * Bloco capa+avatar+nome+bio — cópia quase exata de
         * `ProfileHeader.tsx` (Perfil próprio), ver comentário
         * "ENTREGA 5" no topo do arquivo pro porquê de cada diferença
         * deliberada (`-mx-4` copiado, `-mt-4` não).
         */}
        <div
          className={
            profile.bannerUrl
              ? "mb-6"
              : "mb-6 -mx-4 px-4 pt-4 pb-2 bg-gradient-to-b from-primary/[0.09] via-transparent to-transparent sm:rounded-t-lg"
          }
        >
          {(() => {
            // Avatar (anel de vidro) extraído pra variável e reaproveitado
            // nos dois ramos abaixo (com capa / sem capa) — mesmo desenho,
            // só muda o container que o posiciona.
            const avatarGlass = (
              <>
                <div
                  className="absolute -inset-0.5 rounded-full border border-white/40 shadow-[0_4px_18px_rgba(0,0,0,0.35)] backdrop-blur-md backdrop-saturate-150"
                  style={{
                    background: "radial-gradient(65% 65% at 28% 22%, rgba(255,255,255,0.3), transparent 60%), rgba(255,255,255,0.10)",
                  }}
                  aria-hidden="true"
                />
                {/* BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em `components/common/Avatar.tsx`) — foto quebrada agora cai pras iniciais. */}
                <Avatar src={avatarUrl} name={displayName} className="relative h-full w-full bg-surface" textClassName="text-lg" />
              </>
            );

            const nameBlockContent = (
              <>
                <p className="truncate text-lg font-bold text-text">{displayName}</p>
                <p className="truncate text-sm text-primary">@{profile.username}</p>
                {joinedLine && <p className="truncate text-xs text-muted">{joinedLine}</p>}
              </>
            );

            if (profile.bannerUrl) {
              return (
                <>
                  {/*
                   * ENTREGA 10 (a pedido, 2026-08-26 — depois de 2 rodadas
                   * tentando alinhar avatar+nome LADO A LADO com a foto
                   * sobreposta na capa (Entregas 8 e 9), o usuário mandou
                   * um print de referência de um layout pronto (cards
                   * "Roman Rouf Col." / "James Robertson") e pediu "copie
                   * esse estilo": nome NUMA LINHA PRÓPRIA, ABAIXO do
                   * avatar — não mais do lado. Essa mudança resolve os
                   * dois problemas that vinham se arrastando ao mesmo
                   * tempo, pela raiz, em vez de ficar ajustando margem:
                   *
                   * 1. Alinhamento: não existe mais NENHUMA tentativa de
                   *    centralizar o texto contra o avatar (nem `flex
                   *    items-center`, nem margem negativa calibrada à mão)
                   *    — o texto só começa numa posição fixa, com respiro
                   *    de sobra depois que o avatar termina. Não tem como
                   *    desalinhar o que não está tentando se alinhar.
                   * 2. Legibilidade em capas claras (pergunta feita pelo
                   *    usuário) — o texto nunca mais chega perto da capa
                   *    (fica bem abaixo dela, sempre em cima do fundo
                   *    sólido do card), então nunca corre risco de ficar
                   *    ilegível em cima de uma foto clara, não importa a
                   *    cor da capa.
                   *
                   * Avatar continua IRMÃO da capa (não filho — ver Entrega
                   * 8 pro motivo: filho seria cortado pelo `overflow-hidden`
                   * dela), sobrepondo a borda de baixo com `-bottom-8`
                   * (32px). O bloco de nome agora vem DEPOIS do wrapper
                   * avatar+capa, em fluxo normal, com `pt-10` (40px) — testado
                   * visualmente antes de aplicar (Playwright): dá um respiro
                   * claro entre o avatar e o texto, igual à referência.
                   */}
                  <div className="relative mb-4">
                    <div className="relative -mx-4 h-56 w-[calc(100%+2rem)] overflow-hidden rounded-b-lg bg-surface shadow-lg shadow-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element -- banner externo, sem domínio fixo pra configurar em next/image */}
                      <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="absolute -bottom-8 left-0 h-16 w-16">{avatarGlass}</div>
                  </div>
                  <div className="min-w-0 pt-10">{nameBlockContent}</div>
                </>
              );
            }

            return (
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 shrink-0">{avatarGlass}</div>
                <div className="min-w-0">{nameBlockContent}</div>
              </div>
            );
          })()}

          {profile.bio && <p className="mt-4 text-sm text-text">{profile.bio}</p>}
        </div>

        {/* "Vidro" (redesign âmbar/vidro, perfil público, 2026-08-26) — mesmas pílulas de vidro do cabeçalho do Perfil próprio (ProfileHeader.tsx), em vez de texto solto sem card nenhum por baixo. */}
        <div className="flex gap-2.5">
          {statPills.map((pill, index) => (
            <div
              key={pill.label}
              className="flex-1 rounded-2xl border border-white/10 px-1.5 py-3 text-center backdrop-blur-md"
              style={{
                background:
                  index === statPills.length - 1
                    ? "radial-gradient(75% 90% at 22% 12%, rgba(255,255,255,0.18), transparent 60%), radial-gradient(70% 90% at 85% 100%, rgba(42,127,184,0.22), transparent 60%), rgba(255,255,255,0.10)"
                    : "radial-gradient(75% 90% at 22% 12%, rgba(255,255,255,0.18), transparent 60%), rgba(255,255,255,0.10)",
              }}
            >
              <p className="text-sm font-bold text-text">{pill.value}</p>
              <p className="text-xs text-muted">{pill.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          {isOwnProfile ? (
            // Botão "Editar" — trocado do contorno âmbar simples pela
            // mesma pílula "gel" (borda clara + blur/saturação +
            // gradiente âmbar) do botão "Editar" real de
            // `ProfileHeader.tsx` (a pedido, "deixe igual ao perfil do
            // usuário" — inclui os botões, não só foto/capa/nome).
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
          ) : (
            <FollowButton targetUserId={profile.userId} />
          )}
          <ShareProfileButton username={profile.username} />
        </div>

        <div className="mt-8">
          <StatsCarousel
            stats={statsQuery.data}
            isLoading={statsQuery.isLoading}
            isError={statsQuery.isError}
            ownerLabel={isOwnProfile ? "own" : "other"}
          />
        </div>

        {/*
         * Ordem corrigida (a pedido, 2026-08-26 — "a sequencia de
         * 'séries,séries favoritas,filmes,filmes favoritos' não está
         * igual ao perfil usuário"): antes eram 2 componentes
         * separados (Favoritos, depois Biblioteca), o que dava a
         * ordem errada Séries favoritas → Filmes favoritos → Séries →
         * Filmes. Agora é 1 componente só (`PublicMediaSectionsList`)
         * que intercala os 4 carrosséis na ordem real do Perfil
         * próprio: Séries → Séries favoritas → Filmes → Filmes
         * favoritos (ver `ProfileSectionsList.tsx`).
         */}
        <div className="mt-6">
          <PublicMediaSectionsList userId={profile.userId} username={profile.username} />
        </div>
      </div>
    </div>
  );
}
