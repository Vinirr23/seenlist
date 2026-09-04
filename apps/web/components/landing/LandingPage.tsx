import Image from "next/image";
import Link from "next/link";
import { Tv, CalendarClock, Users, ListChecks, ArrowRight, Check, Star, MessageSquare, ChevronRight } from "lucide-react";
import { getTrendingMovies, getTrendingSeries } from "@/lib/tmdb/client";
import { tmdbImage } from "@/lib/tmdb/image";
import {
  GLASS_CARD,
  GLASS_CARD_BG,
  GLASS_CHIP,
  GLASS_CHIP_BG,
  GEL_BUTTON,
  GEL_BUTTON_STYLE,
  NO_SCROLLBAR,
  CTA_HOVER_BLUE,
  CtaHoverStyle,
  Header,
  Footer,
  StoreBadges,
  AndroidIcon,
} from "./shared";

/**
 * TASK-XXX (2026-09-04, a pedido — "quero que vá pra uma pagina, onde
 * o usuário entenda sobre o que é o app e que visualmente atraia o
 * usuário") — landing page pública em "/", pra quem chega sem sessão.
 * "/" virou rota pública em `middleware.ts`, e `app/page.tsx` só
 * redireciona pra "/series" quando HÁ sessão — sem sessão, renderiza
 * esta página. Fora dos grupos de rota (main)/(auth) de propósito,
 * com o próprio cabeçalho (mesmo raciocínio de `app/beta/page.tsx`).
 *
 * REFORMULAÇÃO (2026-09-04, a pedido — referências visuais: Letterboxd
 * e Serializd) — estrutura da página redesenhada em cima dessas duas
 * referências: hero em tela cheia com imagem de fundo (Letterboxd),
 * fileira de pôsteres logo abaixo, grade "SeenList deixa você..." nos
 * moldes do "LETTERBOXD LETS YOU...", três colunas com ícone + texto +
 * checklist + mockup (formato do "Track your TV shows / Be part of a
 * community / Discover your next watch" do Serializd, mas com os
 * MESMOS mockups ilustrados que já existiam aqui, só reorganizados
 * nesse layout), fileira "Em alta essa semana" com título embaixo de
 * cada pôster, selos de loja (Google Play real, App Store "em breve" —
 * confirmado com o usuário: Android já está publicado de verdade na
 * Play Store, iOS ainda não existe) e um FAQ no final. Cabeçalho e
 * rodapé moraram em `./shared.tsx` a partir do momento em que o
 * rodapé passou a aparecer também em `/about`. Conteúdo do FAQ e dos
 * ícones é só o que o app realmente tem hoje, confirmado no código
 * antes de escrever qualquer frase (nota de 1 a 5 por episódio —
 * `EpisodeStarRatingRow.tsx` —, resenha com spoiler/humor/onde
 * assistiu — `lib/queries/social/reviews.ts` —, importação de TV Time
 * e Trakt — `TvTimeImportWizard.tsx`/`TraktImportWizard.tsx` —, link
 * real da Play Store — `AndroidAppPromoBanner.tsx`).
 *
 * Visual: reaproveita o MESMO vocabulário de design que o resto do
 * app web já usa de verdade — "vidro" (borda translúcida + blur +
 * gradiente radial no `style`, mesma receita de `ProfileHeader.tsx`/
 * `StatisticsCard.tsx`/`UidRow.tsx`) e o botão "geleia" (gradiente
 * radial âmbar + sombra dupla interna, mesma receita do botão
 * "Editar" de `ProfileHeader.tsx`) — não são inventados aqui, são as
 * mesmas constantes/valores já usados em produção, só centralizados
 * em `shared.tsx`. As telas ilustradas (mockup de "Continue
 * assistindo", linha do tempo de "Em breve", carrossel do Explorar,
 * card de recomendação) são recriações estilizadas dos componentes
 * reais (mesma estrutura, cores, ícones), não capturas de tela
 * literais. Os PÔSTERES nelas — e a imagem de fundo do hero — são
 * reais, "em alta" da semana, buscados ao vivo no TMDB (ver
 * `fetchLandingItems`, mesma fonte que o resto do app já usa) — mas
 * código de episódio, progresso, nome de gente e números de exemplo
 * ao redor deles são só ilustração de interface, não dado de conta
 * real nenhuma.
 */

interface LandingItem {
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
}

/**
 * A PEDIDO (2026-09-04 — "preciso que tenha capa de filmes e séries")
 * — pôsteres E imagem de fundo do hero REAIS, buscados ao vivo no
 * TMDB (mesma fonte que o resto do app já usa, `lib/tmdb/client.ts` —
 * nada de nome de filme/série inventado ou fixo). "Em alta" da
 * semana, filme e série intercalados pra variar. Se a busca falhar
 * (TMDB fora do ar, rede), cai pra uma lista vazia — cada mockup
 * abaixo sabe desenhar um bloco de degradê genérico no lugar de
 * qualquer pôster que faltar, e o hero cai pro degradê ambiente; a
 * página nunca quebra por causa disso.
 */
async function fetchLandingItems(): Promise<LandingItem[]> {
  try {
    const [movies, series] = await Promise.all([getTrendingMovies(1, "pt-BR"), getTrendingSeries(1, "pt-BR")]);
    const pool: LandingItem[] = [];
    const max = Math.max(movies.items.length, series.items.length);
    for (let i = 0; i < max; i++) {
      // CORREÇÃO (2026-09-04, achado no build da Vercel — "Object is
      // possibly 'undefined'") — indexar o mesmo array duas vezes
      // (`series.items[i]` no `if` e de novo dentro do `push`) não deixa
      // o TypeScript enxergar que é o MESMO valor já checado — cada
      // acesso por índice é reavaliado à parte, sem narrowing entre um e
      // outro (diferente de checar uma variável). Guardando o item numa
      // constante local ANTES do `if`, o TypeScript narrowa a constante
      // de verdade — resolve o erro na raiz, sem precisar de `!`/`as`.
      const seriesItem = series.items[i];
      if (seriesItem) pool.push({ title: seriesItem.title, posterPath: seriesItem.posterPath, backdropPath: seriesItem.backdropPath });
      const movieItem = movies.items[i];
      if (movieItem) pool.push({ title: movieItem.title, posterPath: movieItem.posterPath, backdropPath: movieItem.backdropPath });
    }
    return pool;
  } catch (error) {
    console.error("[LandingPage] Falha ao buscar filmes/séries em alta do TMDB", error);
    return [];
  }
}

export default async function LandingPage() {
  const pool = await fetchLandingItems();
  const withPoster = pool.filter((item) => item.posterPath);
  const heroBackdrop = pool.find((item) => item.backdropPath)?.backdropPath ?? null;

  const posterRowItems = withPoster.slice(0, 8);
  const trendingItems = withPoster.slice(8, 16);
  const trackPosters = withPoster.slice(16, 19);
  const upcomingPosters = withPoster.slice(19, 21);
  const socialPoster = withPoster[21];

  return (
    <main className="relative overflow-hidden bg-background">
      <CtaHoverStyle />
      <Hero backdropPath={heroBackdrop} />
      <PosterRow items={posterRowItems} />
      <LetsYouGrid />

      {/* Brilho ambiente atrás das seções de fundo liso — mesma dupla âmbar/teal usada em app/beta/page.tsx. */}
      <div
        className="pointer-events-none absolute left-1/2 top-[1400px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute right-[-160px] top-[2400px] h-[420px] w-[520px] rounded-full bg-secondary/10 blur-[130px]"
        aria-hidden="true"
      />

      <Highlights trackPosters={trackPosters} upcomingPosters={upcomingPosters} socialPoster={socialPoster} />
      <TrendingRow items={trendingItems} />
      <MobileBadges />
      <Faq />
      <Footer />
    </main>
  );
}

/**
 * Bloco de pôster reutilizado em toda a página — pôster real do TMDB
 * quando tem (`poster`), ou o bloco de degradê genérico de antes como
 * reserva (TMDB fora do ar, ou a lista veio mais curta que o esperado).
 */
function PosterBlock({
  poster,
  hue,
  className = "",
  radius = "rounded-md",
  sizes = "120px",
}: {
  poster?: LandingItem;
  hue: string;
  className?: string;
  radius?: string;
  sizes?: string;
}) {
  if (poster?.posterPath) {
    return (
      <div className={`relative shrink-0 overflow-hidden bg-surface ${radius} ${className}`}>
        <Image src={tmdbImage(poster.posterPath, "w185")!} alt={poster.title} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }
  return <div className={`shrink-0 bg-gradient-to-br ${hue} ${radius} ${className}`} aria-hidden="true" />;
}

/**
 * Hero em tela cheia com imagem de fundo — mesmo formato de
 * Letterboxd/Serializd (referência visual passada pelo usuário):
 * still/backdrop real do TMDB, degradê escuro por cima pra legibilidade
 * do cabeçalho (topo) e do texto (base), título + CTA centralizados
 * perto da base — sem subtítulo/parágrafo embaixo do título (a
 * pedido, pra ficar mais enxuto, igual a referência).
 */
function Hero({ backdropPath }: { backdropPath: string | null }) {
  return (
    <section className="relative h-[85vh] min-h-[560px] max-h-[780px] w-full overflow-hidden">
      {backdropPath ? (
        <Image
          src={tmdbImage(backdropPath, "w1280")!}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface via-background to-background" aria-hidden="true" />
      )}
      {/*
        Degradês por cima da imagem — dois, cada um cuidando de uma
        ponta:
        A PEDIDO (2026-09-04 — "aonde começa o texto + botão, [o
        Letterboxd] tem é mais escuro pra o usuário conseguir ler") —
        o degradê de baixo (`from-background/95 via-70%`) fica escuro
        BEM mais cedo (a partir de 40% de altura) e continua escuro
        até quase o topo dessa metade, igual a referência — antes ele
        clareava demais no meio (`via-background/10`) e a foto
        "vazava" atrás do título.
      */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-background/85 from-0% via-transparent via-[28%] to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-background from-0% via-background/95 via-[40%] to-transparent to-[78%]"
        aria-hidden="true"
      />

      <Header />

      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 pb-16 pt-10 text-center sm:px-8 sm:pb-20">
        <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-[3.4rem]">
          Acompanhe tudo que você já viu e o que vem por aí, <span className="text-primary">num só lugar</span>.
        </h1>

        <Link
          href="/register"
          className={`${GEL_BUTTON} ${CTA_HOVER_BLUE} px-8 py-4 text-sm font-bold uppercase tracking-wide sm:text-base`}
          style={GEL_BUTTON_STYLE}
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            Criar conta grátis
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </Link>

        <p className="flex items-center gap-1.5 text-xs text-text/60">
          Também disponível para Android
          <AndroidIcon className="h-4 w-4" />
        </p>
      </div>
    </section>
  );
}

/**
 * Fileira de pôsteres logo abaixo do hero — mesmo elemento visual do
 * Letterboxd (linha simples de capas, sem título embaixo). Rola na
 * horizontal no celular, onde não cabem todos.
 */
function PosterRow({ items }: { items: LandingItem[] }) {
  const hues = [
    "from-primary/60 to-primary/10",
    "from-secondary/60 to-secondary/10",
    "from-primary/40 to-secondary/30",
    "from-secondary/40 to-primary/20",
  ];
  return (
    <section className="relative z-10 mx-auto -mt-2 w-full max-w-6xl px-6 pb-3 sm:px-8">
      <div className={`flex gap-3 overflow-x-auto pb-1 sm:gap-4 ${NO_SCROLLBAR}`}>
        {items.map((item, i) => (
          <PosterBlock
            key={i}
            poster={item}
            // `!` (2026-09-04, achado no build da Vercel) — `i % hues.length`
            // sempre cai num índice válido (`hues` tem 4 itens fixos, nunca
            // vazio), mas o TypeScript não consegue provar isso
            // estaticamente (`noUncheckedIndexedAccess` no tsconfig), então
            // tipa como `string | undefined`. A asserção é segura aqui
            // porque o módulo garante o índice dentro dos limites sempre.
            hue={hues[i % hues.length]!}
            className="aspect-[2/3] w-24 shrink-0 sm:w-32"
            radius="rounded-lg"
            sizes="128px"
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Grade "SeenList deixa você..." — mesmo formato do "LETTERBOXD LETS
 * YOU..." (referência visual), seis cartões pequenos com ícone + frase
 * curta. Cada item é uma funcionalidade real do app, não promessa —
 * conferido no código antes de escrever (nota por episódio, resenha
 * com spoiler, linha do tempo de estreias, listas, seguir gente).
 */
function LetsYouGrid() {
  const items = [
    { icon: Tv, text: "Marca cada episódio que você assiste, ou começa a acompanhar a partir de hoje" },
    { icon: Star, text: "Dá uma nota de 1 a 5 estrelas pra cada episódio e guarda sua reação" },
    { icon: MessageSquare, text: "Escreve resenhas com aviso de spoiler, e lê o que os amigos acharam" },
    { icon: CalendarClock, text: "Mostra a agenda de estreias dos seus títulos, série por série" },
    { icon: ListChecks, text: "Monta e compartilha listas de filmes e séries sobre qualquer assunto" },
    { icon: Users, text: "Deixa você seguir outras pessoas e ver o que elas estão assistindo agora" },
  ];
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-14">
      <span className="mb-4 block text-xs font-bold uppercase tracking-[0.2em] text-muted">
        SeenList deixa você...
      </span>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <div key={i} className={`${GLASS_CARD} flex items-start gap-3.5 p-5`} style={GLASS_CARD_BG}>
            <span className={`${GLASS_CHIP} h-9 w-9 shrink-0 items-center justify-center text-primary`} style={GLASS_CHIP_BG}>
              <item.icon className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <p className="text-sm leading-relaxed text-text">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Vidro" de linha (glass-row) — MESMA receita de `ContinueWatchingCard.tsx`/`EmBreveSection.tsx`/`ExploreActivityTab.tsx` (mais opaca que o `GLASS_CARD` genérico do resto desta página, de propósito: é a receita usada nas linhas de LISTA do app de verdade, não a dos cartões maiores). */
const GLASS_ROW_BG = {
  background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
};

/**
 * Mockup de "Continue assistindo" — a pedido (2026-09-04, "deixa esses
 * cards mais parecidos com o real do app"), reconstrução fiel da linha
 * de `ContinueWatchingCard.tsx`: pílula com o nome da série + seta,
 * código T/E em mono-espaçada com o "+N" de episódios pendentes, selo
 * "NOVO" (mesma cor/formato de `BADGE_CLASSNAME.novo`), nome do
 * episódio discreto embaixo, e o botão circular BRANCO de marcar
 * assistido (`EpisodeWatchedButton.tsx`, estado não-assistido) — não
 * existe barra de progresso no card real, então a versão anterior
 * (que tinha uma) foi substituída por esses elementos de verdade.
 * Pôsteres são reais (TMDB, "em alta" da semana); nome de série/
 * episódio são só exemplo de interface.
 *
 * CORREÇÃO (2026-09-04, a pedido — "os dados não estão bem
 * alinhados", depois "continuam desalinhados") — causa raiz achada
 * medindo o print pixel a pixel (Pillow): a 1ª tentativa tinha
 * `items-center` na linha + `justify-center` na coluna de texto,
 * centralizando TUDO como bloco — isso deixava pôster e botão bem
 * alinhados ENTRE SI dentro de cada linha (confirmado: os centros
 * batiam a menos de 1px), mas o RECUO do topo da linha até o pôster
 * mudava conforme o card tinha mais ou menos linhas de texto (14px na
 * linha com o selo "NOVO", 9px na linha sem selo) — é essa
 * inconsistência entre as duas linhas empilhadas que lia como
 * "desalinhado". O real (`ContinueWatchingCard.tsx`) NÃO centraliza
 * bloco nenhum: a linha usa `items-stretch`, o pôster (altura fixa) e
 * a coluna de texto (`div` comum, sem `justify-center`) ficam os dois
 * grudados no TOPO da linha — só o botão de assistido tem
 * `self-center` próprio. Corrigido pra copiar exatamente isso: tirado
 * o `justify-center` da coluna de texto, `items-stretch` de volta na
 * linha — pôster e texto sempre começam no mesmo recuo do topo, linha
 * a linha, não importa quantas linhas de texto cada card tenha.
 *
 * CORREÇÃO 2 (mesmo dia, usuário mandou print de novo — "continua
 * desalinhado") — medido de novo: a correção acima FUNCIONOU (pôster
 * e texto passaram a começar no mesmo recuo — 9px/8px, praticamente
 * igual — nas duas linhas). Sobrava um resíduo menor, só na linha COM
 * selo "NOVO" (4 linhas de texto): o bloco de texto dessa linha
 * (~80px medido) ficava mais ALTO que o pôster (72px) — como o pôster
 * é de altura fixa (não estica), ele fica "curto" perto do texto, a
 * linha inteira estica pra caber o texto, e o botão (que centraliza na
 * altura da LINHA, não do pôster) passa a centralizar abaixo do centro
 * do pôster (4px de diferença, medido). Na linha sem selo (3 linhas,
 * ~64px de texto) isso não acontecia — o pôster continuava sendo o
 * elemento mais alto, e tudo batia perfeitamente (0px de diferença,
 * medido). No app de verdade isso não aparece porque o pôster de lá é
 * bem maior (120px) — sempre "vence" em altura o bloco de texto, com
 * selo ou sem. Corrigido aumentando o pôster daqui (72px → 96px,
 * `h-24 w-16`, mesma proporção 2:3) — grande o suficiente pra ser
 * sempre o elemento mais alto da linha, com ou sem selo, garantindo
 * que pôster e botão sempre centralizem juntos.
 *
 * CORREÇÃO 3 (definitiva, 2026-09-04, a pedido — "pare de fazer
 * ajustes e resolva o problema") — as duas correções acima ainda
 * dependiam de eu ADIVINHAR um número de pixel grande o suficiente
 * pro pôster sempre vencer o texto em altura — funciona até o dia em
 * que o texto de exemplo mudar de novo e voltar a ficar mais alto que
 * esse número. Resolvido na raiz: o pôster daqui NÃO TEM MAIS altura
 * fixa nenhuma (só a largura, `w-16`) — numa linha `items-stretch`
 * (como esta), um item SEM altura própria estica automaticamente pra
 * preencher a altura que os outros irmãos da linha (aqui, a coluna de
 * texto) precisarem, sempre, não importa quantas linhas o texto tenha
 * daqui pra frente. Pôster e botão (que já centralizava na altura da
 * LINHA) ficam garantidamente alinhados por construção, não por
 * coincidência de medida.
 */
function TrackingMockup({ posters }: { posters: LandingItem[] }) {
  const rows = [
    { hue: "from-primary/70 to-primary/20", title: "O Sobrevivente", code: "T02 · E04", extra: 2, name: "A Travessia", badge: "NOVO" },
    { hue: "from-secondary/70 to-secondary/20", title: "Cidade Cinza", code: "T01 · E11", extra: 0, name: "O Retorno", badge: null },
  ];
  return (
    <div className={`${GLASS_CARD} relative mx-auto w-full max-w-xs p-5`} style={GLASS_CARD_BG}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Continue assistindo</span>
        <Tv className="h-4 w-4 text-primary" strokeWidth={2} />
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-stretch gap-2.5 rounded-2xl border border-white/[0.08] px-2.5 py-2"
            style={GLASS_ROW_BG}
          >
            <PosterBlock poster={posters[i]} hue={row.hue} className="w-16 shrink-0" sizes="64px" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text">
                <span className="min-w-0 truncate">{row.title}</span>
                <ChevronRight className="h-2.5 w-2.5 shrink-0" strokeWidth={3} />
              </span>
              {/* whitespace-nowrap (2026-09-04) — mesma prevenção aplicada no `UpcomingMockup`: sem isso, o código pode quebrar em duas linhas se o espaço apertar (achado real lá; aqui é defensivo, pela mesma causa). */}
              <p className="flex items-center gap-1.5 whitespace-nowrap font-mono text-xs font-extrabold tracking-tight text-text">
                {row.code}
                {row.extra > 0 && (
                  <span className="rounded bg-primary/15 px-1 font-sans text-[9px] font-bold text-primary">+{row.extra}</span>
                )}
              </p>
              <p className="truncate text-[11px] text-muted/85">{row.name}</p>
              {row.badge && (
                <span className="inline-block w-fit rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-semibold tracking-wide text-background">
                  {row.badge}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center self-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black shadow-sm">
                <Check className="h-4 w-4" strokeWidth={2.5} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mockup de "Em breve" — a pedido (2026-09-04), reconstrução fiel da
 * linha de `EmBreveSection.tsx`: cápsula "Hoje" (mesmo "vidro" de
 * `SectionTitle.tsx`), trilha com ponto + linha conectando os cards do
 * mesmo grupo, card com pôster/título/código+selo/nome do episódio, e
 * a coluna da direita mostrando OU a emissora OU a contagem de dias
 * até a estreia — os dois comportamentos reais (`daysUntil >= 7` mostra
 * a contagem, senão mostra a emissora), não só um dos dois como antes.
 *
 * CORREÇÃO (2026-09-04, mesmo achado do `TrackingMockup` acima,
 * confirmado comparando com prints reais que o usuário mandou das
 * abas "Minha Lista"/"Em breve") — o pôster daqui (64px) era menor
 * que o bloco de texto (título + código/selo + nome do episódio, ~3
 * linhas) — como a linha usa `items-start` (não `stretch`) e a
 * emissora/dias tem `self-center` PRÓPRIO (exatamente como o real
 * `EmBreveSection.tsx`), ela centralizava na altura do TEXTO (mais
 * alto), não na do pôster (mais baixo) — o pôster sobrava "curto",
 * com vão vazio embaixo. Corrigido copiando o tamanho REAL do pôster
 * daqui (`h-20 w-[70px]`, o mesmo valor de `EmBreveSection.tsx`) —
 * grande o bastante pra sempre dominar a altura da linha — e trocado
 * `truncate` por `line-clamp-2` no título (também igual ao real),
 * pra não cortar no meio da palavra quando o título for mais longo.
 *
 * CORREÇÃO 2 (definitiva, mesmo dia, mesmo pedido — "pare de fazer
 * ajustes e resolva o problema") — ainda insuficiente: com
 * `line-clamp-2`, um título que REALMENTE quebra em 2 linhas (como
 * "Ponto de Retorno" nesse espaço estreito) faz o texto ficar mais
 * alto que os 80px fixos do pôster de novo — o mesmo problema, só que
 * precisando de um número ainda maior, sem fim à vista. Resolvido na
 * raiz, mesma solução do `TrackingMockup`: tirada a altura fixa do
 * pôster (só a largura, `w-[70px]`) e a linha virou `items-stretch`
 * (era `items-start`) — sem altura própria, o pôster estica sozinho
 * pra bater com a coluna de texto, não importa quantas linhas ela
 * tenha. Alinhado por construção, não por um número escolhido a dedo.
 */
function UpcomingMockup({ posters }: { posters: LandingItem[] }) {
  const rows: {
    hue: string;
    title: string;
    code: string;
    badgeLabel: string | null;
    badgeClass: string;
    name: string | null;
    network: string | null;
    daysUntil: number | null;
  }[] = [
    {
      hue: "from-secondary/70 to-secondary/20",
      title: "Ponto de Retorno",
      code: "T03 · E08",
      // A PEDIDO (2026-09-04) — removido: o selo "NOVO" nessa linha
      // espremia o código pro lado e o "T03 · E08" quebrava em duas
      // linhas dentro do card estreito da landing (ver `whitespace-nowrap`
      // abaixo, correção de raiz pro código nunca mais quebrar — isto
      // aqui só tira o que estava competindo pelo espaço).
      badgeLabel: null,
      badgeClass: "bg-primary text-background",
      name: "Cerco Final",
      network: "Streaming",
      daysUntil: null,
    },
    { hue: "from-primary/70 to-primary/20", title: "Fúria", code: "T01 · E02", badgeLabel: null, badgeClass: "", name: null, network: null, daysUntil: 3 },
  ];
  return (
    <div className={`${GLASS_CARD} mx-auto w-full max-w-xs p-5`} style={GLASS_CARD_BG}>
      <div className="mb-4 flex justify-center">
        <span className={`${GLASS_CHIP} px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-muted`} style={GLASS_CHIP_BG}>
          Hoje
        </span>
      </div>
      <div className="flex flex-col">
        {rows.map((row, i, arr) => (
          <div key={i} className="flex gap-2.5">
            <div className="flex w-3 shrink-0 flex-col items-center">
              <span className={`h-2 w-2 shrink-0 rounded-full ${i === 0 ? "bg-primary" : "bg-white/[0.22]"}`} />
              {i < arr.length - 1 && <span className="w-px flex-1 bg-white/[0.13]" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-stretch gap-2 rounded-2xl border border-white/10 p-2" style={GLASS_ROW_BG}>
                <PosterBlock poster={posters[i]} hue={row.hue} className="w-[70px] shrink-0" radius="rounded" sizes="70px" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-text">{row.title}</p>
                  <div className="flex items-center gap-1.5">
                    {/*
                     * CORREÇÃO DE RAIZ (2026-09-04, achado real — "t03 e
                     * 08 deviam estar na mesma linha") — este `<p>` não
                     * tinha `whitespace-nowrap`, então quando a linha do
                     * código dividia espaço com o selo (`gap-1.5`) e o
                     * espaço sobrando ficava justo, o navegador quebrava o
                     * texto no espaço antes do "E08" — como texto comum
                     * quebra, não como os itens flex que tratam
                     * `justify-content`. `whitespace-nowrap` garante que o
                     * código NUNCA quebra em duas linhas, não importa o
                     * quanto o espaço aperte.
                     */}
                    <p className="whitespace-nowrap font-mono text-xs font-bold text-text">{row.code}</p>
                    {row.badgeLabel && (
                      <span className={`inline-block w-fit shrink-0 rounded px-1 py-px text-[8px] font-semibold ${row.badgeClass}`}>
                        {row.badgeLabel}
                      </span>
                    )}
                  </div>
                  {row.name && <p className="truncate text-[11px] text-muted/70">{row.name}</p>}
                </div>
                {row.daysUntil !== null ? (
                  <div className="flex shrink-0 flex-col items-center self-center">
                    <span className="text-lg font-extrabold leading-none text-text">{row.daysUntil}</span>
                    <span className="text-[9px] font-bold tracking-wide text-muted">dias</span>
                  </div>
                ) : (
                  row.network && (
                    <div className="max-w-[64px] shrink-0 self-center text-right">
                      <p className="truncate text-[11px] text-muted">{row.network}</p>
                    </div>
                  )
                )}
              </div>
              {i < arr.length - 1 && <div className="h-2" aria-hidden="true" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Mockup social — a pedido (2026-09-04), reconstrução fiel de
 * `ProfileRecommendationsPreview.tsx` na variante "tem recomendação
 * não lida": mesmo contorno/fundo âmbar de destaque, avatares
 * sobrepostos com o selo numérico (não mais uma bolinha solta), texto
 * "Fulano recomendou 'Título' pra você" e o pôster em miniatura à
 * direita.
 */
function SocialMockup({ poster }: { poster?: LandingItem }) {
  return (
    <div
      className="mx-auto flex w-full max-w-xs items-center gap-3 rounded-2xl border border-primary/60 bg-primary/5 px-4 py-3.5 shadow-[0_6px_18px_rgba(0,0,0,0.3)] ring-1 ring-primary/20 backdrop-blur-[18px] backdrop-saturate-[180%]"
    >
      <div className="relative shrink-0">
        <div className="flex -space-x-3">
          {["bg-primary/70", "bg-secondary/70", "bg-primary/40"].map((bg, i) => (
            <div key={i} className={`h-8 w-8 rounded-full border-2 border-surface ${bg}`} style={{ zIndex: 3 - i }} />
          ))}
        </div>
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface bg-primary px-1 text-[9px] font-bold leading-none text-background">
          2
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm text-text">
          <span className="font-semibold">Ana</span> recomendou{" "}
          <span className="font-semibold">&quot;{poster?.title ?? "um título"}&quot;</span> pra você
        </p>
      </div>
      {poster?.posterPath && (
        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-background">
          <Image src={tmdbImage(poster.posterPath, "w185")!} alt={poster.title} fill sizes="40px" className="object-cover" />
        </div>
      )}
    </div>
  );
}

/**
 * Três colunas — formato do "Track your TV shows / Be part of a
 * community / Discover your next watch" do Serializd (referência
 * visual), mas com os mesmos mockups ilustrados que já existiam nesta
 * página, só reorganizados nesse layout de coluna (ícone + título +
 * descrição + checklist + mockup embaixo).
 */
function Highlights({
  trackPosters,
  upcomingPosters,
  socialPoster,
}: {
  trackPosters: LandingItem[];
  upcomingPosters: LandingItem[];
  socialPoster?: LandingItem;
}) {
  const columns = [
    {
      icon: Tv,
      title: "Acompanhe episódio por episódio",
      description:
        "Marque o que já assistiu, dê nota pra cada episódio e guarde sua reação — tudo isso funcionando em qualquer plataforma de streaming.",
      items: ["Marque cada episódio assistido", "Dê nota de 1 a 5 estrelas", "Escreva sua reação, sem soltar spoiler"],
      visual: <TrackingMockup posters={trackPosters} />,
    },
    {
      icon: CalendarClock,
      title: "Nunca perca uma estreia",
      description:
        "A aba Em breve organiza os próximos episódios das suas séries por data, pra você saber exatamente o que estreia essa semana.",
      items: ["Linha do tempo dos próximos episódios", "Data e emissora de cada estreia", "Zero spoiler antes da hora"],
      visual: <UpcomingMockup posters={upcomingPosters} />,
    },
    {
      icon: Users,
      title: "Faça parte de uma comunidade",
      description:
        "Siga amigos, veja o que eles estão assistindo, recomende títulos e comente episódio por episódio com aviso de spoiler.",
      items: ["Siga seus amigos", "Veja o que eles estão assistindo", "Receba e mande recomendações"],
      visual: <SocialMockup poster={socialPoster} />,
    },
  ];

  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-14">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col items-center gap-4 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15"
              style={GEL_BUTTON_STYLE}
            >
              <col.icon className="h-6 w-6 text-background" strokeWidth={2.25} />
            </div>
            <h3 className="text-balance text-xl font-extrabold text-text">{col.title}</h3>
            <p className="max-w-xs text-pretty text-sm leading-relaxed text-muted">{col.description}</p>
            <div className="flex flex-col items-start gap-2">
              {col.items.map((item) => (
                <span key={item} className="flex items-center gap-2 text-left text-xs font-medium text-text/80">
                  <Check className="h-3.5 w-3.5 shrink-0 text-secondary" strokeWidth={2.5} />
                  {item}
                </span>
              ))}
            </div>
            {/*
             * BUG REAL CORRIGIDO (2026-09-04, achado medindo pixel a
             * pixel o print que o usuário mandou — "a travessia devia
             * estar embaixo de t02 e04", "fúria está mais pra direita")
             * — causa raiz: a coluna inteira do Highlights (acima) usa
             * `text-center`, pensado pro título/descrição/checklist
             * (prosa central). Isso vaza por herança de CSS pra dentro
             * dos mockups aqui embaixo. Elementos que usam `flex`
             * internamente (a pílula do título, a linha de código T/E)
             * escapam porque flex posiciona por `justify-content`, não
             * por `text-align` — só os `<p>` "soltos" (nome do
             * episódio, título do "Em breve") ficavam centralizados
             * dentro da própria largura esticada, com um vão vazio à
             * esquerda que empurrava o texto pra direita. O checklist
             * de items (`text-left` na `<span>` da linha 621, acima) já
             * tinha esse mesmo remendo — só faltava aqui. `text-left`
             * no wrapper inteiro do visual reseta pra toda a árvore
             * (os 3 mockups), num lugar só, em vez de remendar cada
             * `<p>` um por um dentro de cada mockup.
             */}
            <div className="mt-2 w-full text-left">{col.visual}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * "Em alta essa semana" — mesma ideia do "Trending TV shows" do
 * Serializd (referência visual): fileira de pôsteres reais com o
 * título embaixo de cada um.
 */
function TrendingRow({ items }: { items: LandingItem[] }) {
  const hues = [
    "from-primary/60 to-primary/10",
    "from-secondary/60 to-secondary/10",
    "from-primary/40 to-secondary/30",
    "from-secondary/40 to-primary/20",
  ];
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 sm:py-14">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-text sm:text-2xl">Em alta essa semana</h2>
        <Link href="/register" className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Ver tudo
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </Link>
      </div>
      <div className={`flex gap-4 overflow-x-auto pb-2 ${NO_SCROLLBAR}`}>
        {items.map((item, i) => (
          <div key={i} className="flex w-28 shrink-0 flex-col gap-2 sm:w-32">
            <PosterBlock
              poster={item}
              // `!` — mesma garantia/explicação do `PosterRow` acima: índice
              // do módulo sempre válido, `hues` fixo com 4 itens.
              hue={hues[i % hues.length]!}
              className="aspect-[2/3] w-full"
              radius="rounded-lg"
              sizes="128px"
            />
            <span className="truncate text-xs font-medium text-muted">{item.title}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Selos de loja — mesma ideia do "Also available on mobile!" do
 * Serializd (referência visual: título "Também disponível no
 * mobile!" e a seção com um tom de fundo diferente do resto da
 * página — aqui `bg-surface`, o segundo tom da escala de cor que o
 * app já usa, pra não inventar uma cor nova). Selos de verdade (ver
 * `StoreBadges` em `shared.tsx`, mesmo par que aparece de novo no
 * rodapé — a pedido).
 */
function MobileBadges() {
  return (
    <section className="relative z-10 w-full bg-surface">
      <div className="mx-auto w-full max-w-3xl px-6 py-14 text-center sm:px-8 sm:py-20">
        <h2 className="text-balance text-2xl font-extrabold text-text sm:text-3xl">Também disponível no mobile!</h2>
        <div className="mt-8 flex justify-center">
          <StoreBadges />
        </div>
      </div>
    </section>
  );
}

/**
 * Perguntas frequentes — mesma ideia do FAQ do Serializd (referência
 * visual), mas com respostas verdadeiras sobre o SeenList, conferidas
 * no código antes de escrever (nada inventado): importação de TV Time
 * e Trakt, dado do TMDB (mesma frase de `app/terms/page.tsx`), telas
 * de Feedback reais em Configurações.
 */
function Faq() {
  const items = [
    {
      q: "O que é o SeenList?",
      a: "O SeenList é uma plataforma pra acompanhar tudo que você assiste — séries e filmes, episódio por episódio — e uma comunidade de gente que também leva isso a sério. Você marca o que já viu, dá nota, escreve resenhas, monta listas e acompanha o que os amigos estão assistindo.",
    },
    {
      q: "O SeenList é gratuito?",
      a: "Sim! O SeenList é gratuito pra usar.",
    },
    {
      q: "Posso importar meus dados de outro app?",
      a: "Sim — o SeenList importa seu histórico direto do TV Time e do Trakt, direto de dentro do app.",
    },
    {
      q: "Em quais plataformas o SeenList está disponível?",
      a: "Nesse site (web) e no Android, pela Google Play Store. Uma versão pra iOS ainda está a caminho.",
    },
    {
      q: "De onde vêm os dados de filmes e séries?",
      a: "Do TMDB (The Movie Database) — o SeenList não é afiliado ao TMDB nem certificado por eles.",
    },
    {
      q: "Encontrei um bug — como reporto?",
      a: "Manda pela tela de Feedback, dentro de Configurações — tanto no site quanto no app, já logado na sua conta.",
    },
  ];
  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl px-6 py-10 sm:px-8 sm:py-16">
      <h2 className="text-balance text-center text-2xl font-extrabold text-text sm:text-3xl">
        Perguntas frequentes
      </h2>
      <div className="mt-10 flex flex-col gap-8">
        {items.map((item) => (
          <div key={item.q}>
            <h3 className="text-base font-bold text-text">{item.q}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
