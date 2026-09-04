import Link from "next/link";
import { Tv, Star, MessageSquare, CalendarClock, ListChecks, Users, Download, Bug, Mail } from "lucide-react";
import {
  GLASS_CARD,
  GLASS_CARD_BG,
  GLASS_CHIP,
  GLASS_CHIP_BG,
  Header,
  Footer,
  SOCIAL_LINKS,
} from "@/components/landing/shared";

/**
 * TASK-XXX (2026-09-04, a pedido — "privacidade, termos adiciona um
 * about, te mandei um print pra você se basear") — página pública
 * "/about" ("/about" entrou em `PUBLIC_ROUTES`, `middleware.ts`),
 * referência visual: a aba "About" do Serializd (sidebar com "What is
 * Serializd?", Data, Contact/Socials, Privacy Policy, Community
 * Policy, How do I report bugs?, Roadmap).
 *
 * DECISÃO TOMADA (a comunicar, não decidida sozinha por completo —
 * "nunca tome grandes decisões, dê as opções") — em vez da mesma
 * estrutura de VÁRIAS páginas com barra lateral, isto é UMA página só
 * com seções, reaproveitando cabeçalho/rodapé de `shared.tsx`:
 * Privacidade e Termos já são páginas próprias (`/privacy`, `/terms`,
 * linkadas aqui, não duplicadas), e não existe "Community Policy" nem
 * "Roadmap" público hoje no SeenList — inventar conteúdo pra essas
 * duas quebraria a regra de "nunca assumir nada"/"nada inventado". Se
 * o usuário quiser essas duas seções, ou preferir voltar pro formato
 * de várias páginas com sidebar, é só pedir.
 *
 * Todo o conteúdo abaixo é sobre funcionalidade REAL, conferida no
 * código antes de escrever (mesma checagem já feita pra `LandingPage`):
 * nota de episódio (`EpisodeStarRatingRow.tsx`), resenha com spoiler/
 * humor/personagem favorito/onde assistiu (`lib/queries/social/
 * reviews.ts`), importação de TV Time e Trakt (`TvTimeImportWizard.tsx`
 * /`TraktImportWizard.tsx`), tela de Feedback real em Configurações
 * (`SettingsPage.tsx`), atribuição do TMDB com a MESMA frase de
 * `app/terms/page.tsx`, link real da Play Store
 * (`AndroidAppPromoBanner.tsx`), e-mail de contato o mesmo já usado em
 * `/privacy`/`/terms` (contato@seenlist.app).
 */
export default function AboutPage() {
  const features = [
    { icon: Tv, title: "Acompanhe episódio por episódio", text: "Marque cada episódio assistido, de qualquer série, em qualquer plataforma de streaming." },
    { icon: Star, title: "Avalie do seu jeito", text: "Dê uma nota de 1 a 5 estrelas pra cada episódio — não só pra série inteira." },
    { icon: MessageSquare, title: "Escreva resenhas", text: "Com aviso de spoiler, humor da cena, personagem favorito e onde você assistiu." },
    { icon: CalendarClock, title: "Agenda de estreias", text: "Veja os próximos episódios das suas séries organizados por data, sem se perder." },
    { icon: ListChecks, title: "Monte listas", text: "Crie e compartilhe listas de filmes e séries sobre qualquer assunto." },
    { icon: Users, title: "Comunidade", text: "Siga outras pessoas, veja o que elas estão assistindo e troque recomendações." },
    { icon: Download, title: "Importe seu histórico", text: "Já usava TV Time ou Trakt? Importe tudo pro SeenList direto de dentro do app." },
  ];

  return (
    <main className="relative overflow-hidden bg-background">
      <Header />

      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-4 pt-6 text-center sm:px-8 sm:pt-10">
        <span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-muted">Sobre</span>
        <h1 className="text-balance text-3xl font-extrabold leading-tight text-text sm:text-4xl">
          O que é o <span className="text-primary">SeenList</span>?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted">
          O SeenList é uma plataforma gratuita pra acompanhar tudo que você assiste — séries e
          filmes, episódio por episódio — e uma comunidade de gente que também leva isso a sério.
          Disponível na web e no Android, com uma versão pra iOS a caminho.
        </p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10 sm:px-8 sm:py-14">
        <h2 className="mb-5 text-lg font-extrabold text-text">O que dá pra fazer</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((item) => (
            <div key={item.title} className={`${GLASS_CARD} flex items-start gap-3.5 p-5`} style={GLASS_CARD_BG}>
              <span className={`${GLASS_CHIP} h-9 w-9 shrink-0 items-center justify-center text-primary`} style={GLASS_CHIP_BG}>
                <item.icon className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-text">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 py-10 sm:px-8 sm:py-14">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-lg font-extrabold text-text">Dados de filmes e séries</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Título, sinopse, elenco e pôster vêm do TMDB (The Movie Database) — o SeenList não
              é afiliado ao TMDB nem certificado por eles.
            </p>
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-text">
              <Bug className="h-4 w-4 text-primary" strokeWidth={2.25} />
              Encontrou um bug?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Manda pela tela de Feedback, dentro de Configurações — tanto no site quanto no app,
              já logado na sua conta.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-3xl px-6 py-10 text-center sm:px-8 sm:py-14">
        <h2 className="text-lg font-extrabold text-text">Fale com a gente</h2>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
          <Mail className="h-4 w-4" strokeWidth={2} />
          <a href="mailto:contato@seenlist.app" className="font-medium text-text transition-colors hover:text-primary">
            contato@seenlist.app
          </a>
        </p>
        <div className="mt-5 flex items-center justify-center gap-4">
          {SOCIAL_LINKS.map(({ label, href, Icon }) => (
            <Link
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted transition-colors hover:border-primary/50 hover:text-text"
            >
              <Icon className="h-5 w-5" />
            </Link>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted">
          Consulte também a{" "}
          <Link href="/privacy" className="underline hover:text-text">
            Política de Privacidade
          </Link>{" "}
          e os{" "}
          <Link href="/terms" className="underline hover:text-text">
            Termos de Uso
          </Link>
          .
        </p>
      </section>

      <Footer />
    </main>
  );
}
