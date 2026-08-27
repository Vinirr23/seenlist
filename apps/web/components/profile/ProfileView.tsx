"use client";

import { useCurrentUser } from "@/lib/queries/current-user";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ProfileHeader } from "./ProfileHeader";
import { StatisticsCard } from "./StatisticsCard";
import { ProfileSectionsList } from "./ProfileSectionsList";

/**
 * Item 8: loading / empty / error, "nunca deixar a tela vazia" — os
 * três estados abaixo cobrem `useCurrentUser`; `ProfileStatsGrid` já
 * cuida dos seus próprios estados internamente (mesmo padrão usado
 * em toda mutation/query do projeto).
 *
 * Tradução (4º lote) — Perfil.
 *
 * Redesign (a pedido) — `SettingsSection` ("Configurações") e
 * `LogoutButton` ("Sair") saíram daqui: viraram redundantes depois
 * que o ícone de engrenagem passou a flutuar sobre a capa
 * (`ProfileHeader.tsx`), levando direto pra `/profile/settings` —
 * que já tem tanto as configurações quanto o botão de sair dentro
 * dela (conferido antes de remover, pra não tirar o único jeito de
 * sair da conta).
 */
export function ProfileView() {
  const { data: user, isLoading, isError } = useCurrentUser();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t("profile.loadingProfile")}>
        <div className="h-16 animate-pulse rounded-full bg-surface" />
        <div className="h-24 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-muted">{t("profile.loadError")}</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted">{t("profile.noData")}</p>;
  }

  return (
    <div className="relative">
      {/*
       * "Vidro iluminado" (mockup-perfil-atual-vidro, 2026-08-21) —
       * os cards de vidro abaixo (pílulas, card de estatísticas,
       * recomendações, listas) usam `backdrop-blur`, mas sem algo
       * colorido atrás pra borrar, o blur não tem o que fazer e o
       * "vidro" acaba parecendo só uma camada branca pintada. Essas
       * manchas (só tons de azul, a pedido) são o que dá o efeito de
       * verdade — decorativas, não fazem parte do conteúdo.
       *
       * CAUSA RAIZ #1 do "não tem os tons azul no fundo" (achada
       * investigando, não assumida): a versão anterior usava
       * `position: fixed` + tamanho em `vw`, achando que isso seria
       * mais robusto que pixel fixo — mas `fixed` posiciona relativo
       * à JANELA INTEIRA do navegador, não à coluna de ~430px onde o
       * conteúdo realmente fica (`app/(main)/profile/page.tsx`,
       * `max-w-[430px] mx-auto` no desktop). Corrigido voltando pra
       * `position: absolute` dentro do `<div className="relative">`.
       *
       * CAUSA RAIZ #2 (achada depois, com o navegador confirmando via
       * `getBoundingClientRect` a posição real de cada mancha em
       * pixels na tela) — top em PORCENTAGEM parecia "robusto a
       * conteúdo de altura variável", mas essa porcentagem é calculada
       * em cima da altura TOTAL da coluna inteira (cabeçalho +
       * estatísticas + recomendações + listas + os 4 carrosséis de
       * pôster lá embaixo, ~2000px) — não só da parte "vidro" no topo
       * (~800px). Medido na prática: a mancha 1 caía 100% atrás da
       * capa (foto opaca, cobre tudo); as manchas 3/4/5 caíam bem
       * abaixo de "Minhas listas", atrás dos carrosséis de pôster
       * (`ProfileMediaCarousel.tsx`) — que são cards OPACOS (pôster de
       * verdade ou `bg-surface` sólido), não vidro — a mancha nunca
       * teria como aparecer ali, mesmo estando 100% presente e correta
       * no HTML (foi isso que o `getBoundingClientRect` provou).
       *
       * Fix: top em PIXEL FIXO (não mais porcentagem), calibrado pra
       * cair dentro da faixa real onde existem cards de vidro de
       * verdade (cabeçalho → Estatísticas → Recomendações → Minhas
       * listas, medido ≈0-900px) — nada posicionado atrás dos
       * carrosséis de pôster, que são opacos e nunca deixariam a cor
       * aparecer mesmo.
       *
       * CAUSA RAIZ #3 (a de verdade — achada testando ao vivo no
       * navegador, trocando uma propriedade de cada vez): mesmo com
       * posição, opacidade, cor e blur 100% corretos (confirmados via
       * `getComputedStyle`), a mancha simplesmente não pintava NENHUM
       * pixel — leitura direta de cor do print provava isso (fundo
       * saía exatamente `rgb(11,14,20)`, a cor pura de fundo, sem
       * nenhum traço de azul misturado). Isolando uma propriedade por
       * vez ao vivo: `overflow: visible` sozinho não resolvia; só
       * tirar o `z-index` NEGATIVO (trocar por `0`) resolvia sozinho.
       * Ou seja: `z-index: -10` não estava só jogando a camada pra
       * trás como devia — estava fazendo o navegador não desenhar ela
       * de jeito nenhum (provavelmente um contexto de empilhamento
       * mais acima na árvore, fora deste componente, "engolindo"
       * qualquer coisa com z-index negativo). Fix: tirado o `-z-10`.
       * Não precisa dele mesmo — sem z-index em NENHUM elemento aqui
       * (nem nesta camada nem no cabeçalho/cards depois dela), a
       * ordem do próprio código já resolve: quem vem primeiro no
       * HTML pinta embaixo, quem vem depois pinta em cima — e essa
       * camada de azul é a primeira coisa dentro do `<div
       * className="relative">`, antes do `ProfileHeader`,
       * `StatisticsCard` e `ProfileSectionsList`.
       *
       * AJUSTE #1 (a pedido, "ficou com um limite estranho" #1) — as 5
       * manchas acima param todas antes de ~1100px, exatamente onde
       * começam os carrosséis de pôster (`ProfileMediaCarousel.tsx`,
       * opacos, nunca revelariam a cor mesmo) — criava uma linha dura
       * de "aqui tem azul, dali pra baixo não tem nada". As 3 manchas
       * abaixo (menores, cada vez mais fracas) ficam nos ESPAÇOS entre
       * um carrossel e outro (a margem/o título da seção seguinte,
       * não em cima dos pôsteres em si) — só pra esmaecer aos poucos
       * até sumir de vez, em vez de cortar seco.
       *
       * AJUSTE #2 (a pedido, "ficou com um limite estranho" #2 — dessa
       * vez em tela LARGA, desktop/notebook) — medindo os pixels do
       * print (usuário confirmou que usa a tela larga também, não só
       * celular): a coluna de conteúdo fica centralizada em ~430px
       * (`app/(main)/profile/page.tsx`, `md:max-w-[430px] mx-auto`) —
       * fora dela, o `overflow-hidden` DESTA camada cortava o brilho
       * seco bem na borda da coluna, criando uma "caixa" retangular
       * de luz visível contra o fundo liso dos dois lados. Tirado o
       * `overflow-hidden` daqui — agora o desfoque vaza naturalmente
       * pro espaço vazio ao redor da coluna em telas largas (esmaecendo
       * sozinho, é assim que blur funciona sem nada cortando ele no
       * meio do caminho) e não muda nada no celular (lá a coluna já
       * ocupa a tela toda, não tem espaço sobrando pra vazar). A trava
       * contra rolagem horizontal que isso poderia introduzir (a
       * mancha se estende um pouco além da borda esquerda/direita da
       * coluna, de propósito, sempre existiu) foi movida um nível
       * acima, pro `MainLayout` (`app/(main)/layout.tsx`,
       * `overflow-x-hidden`), então continua 100% seguro contra barra
       * de rolagem horizontal em qualquer tamanho de tela.
       */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]"
          style={{ top: "220px", left: "-22%", background: "#1B4B7A" }}
        />
        <div
          className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]"
          style={{ top: "460px", right: "-20%", background: "#2A7FB8" }}
        />
        <div
          className="absolute h-64 w-64 rounded-full opacity-45 blur-[60px]"
          style={{ top: "610px", left: "-18%", background: "#0D3B5C" }}
        />
        <div
          className="absolute h-60 w-60 rounded-full opacity-40 blur-[60px]"
          style={{ top: "760px", right: "-20%", background: "#2A7FB8" }}
        />
        <div
          className="absolute h-56 w-56 rounded-full opacity-35 blur-[60px]"
          style={{ top: "880px", left: "-16%", background: "#1B4B7A" }}
        />
        <div
          className="absolute h-48 w-48 rounded-full opacity-28 blur-[60px]"
          style={{ top: "1140px", right: "-18%", background: "#2A7FB8" }}
        />
        <div
          className="absolute h-44 w-44 rounded-full opacity-20 blur-[60px]"
          style={{ top: "1450px", left: "-14%", background: "#0D3B5C" }}
        />
        <div
          className="absolute h-40 w-40 rounded-full opacity-12 blur-[60px]"
          style={{ top: "1760px", right: "-14%", background: "#1B4B7A" }}
        />
      </div>

      <ProfileHeader user={user} />
      <StatisticsCard />

      <ProfileSectionsList />
    </div>
  );
}
