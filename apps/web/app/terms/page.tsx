import type { Metadata } from "next";

// SEO (2026-09-04) — mesmo motivo/correção do `app/about/page.tsx`
// (ver comentário lá): sem `alternates.canonical` próprio, herdava o
// canonical fixo da home definido em `app/layout.tsx`, e o Google
// nunca indexaria esta página como própria.
export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Os termos de uso do SeenList: o que esperamos de você e o que você pode esperar do aplicativo.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 prose">
      <h1>Termos de Uso</h1>

      <p>Última atualização: 5 de agosto de 2026</p>

      <p>
        Ao criar uma conta ou usar o SeenList, você concorda com estes termos. Se não concordar,
        não utilize o aplicativo.
      </p>

      <h2>1. O que é o SeenList</h2>

      <p>
        O SeenList é um aplicativo gratuito de acompanhamento de séries e filmes, com biblioteca
        pessoal, avaliações, e recursos sociais (Feed, comentários, seguir outras pessoas). Os
        dados de filmes e séries (título, sinopse, elenco, pôster) vêm do TMDB (The Movie
        Database) — o SeenList não é afiliado ao TMDB nem certificado por eles.
      </p>

      <h2>2. Quem pode usar</h2>

      <p>
        Você precisa ter 16 (dezesseis) anos ou mais pra criar uma conta. Ao se cadastrar, você
        declara que as informações fornecidas são verdadeiras.
      </p>

      <h2>3. Sua conta</h2>

      <p>
        Você é responsável por manter a confidencialidade da sua senha e por tudo que acontecer
        na sua conta. Avise a gente imediatamente (contato@seenlist.app) se suspeitar de uso não
        autorizado.
      </p>

      <h2>4. Conteúdo que você publica</h2>

      <p>
        Você mantém a propriedade de tudo que publica (posts, comentários, avaliações, fotos de
        perfil). Ao publicar algo visível a outras pessoas, você nos dá permissão de exibir esse
        conteúdo dentro do aplicativo, pelo tempo em que ele existir — isso é só o necessário pra
        fazer o Feed e as avaliações funcionarem, não uma cessão de direitos autorais.
      </p>

      <p><strong>Você é o único responsável pelo que publica.</strong> É proibido publicar:</p>

      <ul>
        <li>Spam ou conteúdo comercial não autorizado.</li>
        <li>Conteúdo ilegal sob a lei brasileira.</li>
        <li>Violação de direitos autorais ou de imagem de terceiros.</li>
        <li>Discurso de ódio, assédio, ameaça ou incitação à violência.</li>
        <li>Conteúdo sexual envolvendo menores, sob qualquer hipótese.</li>
        <li>Informação falsa apresentada como verdadeira, de forma a enganar outros usuários.</li>
        <li>Spoiler sem aviso, fora do contexto em que isso é esperado.</li>
      </ul>

      <p>
        Você pode denunciar conteúdo que viole estes termos usando a opção de denúncia dentro do
        app. Nos reservamos o direito de remover qualquer conteúdo que viole estes termos, com ou
        sem aviso prévio.
      </p>

      <h2>5. Uso aceitável do serviço</h2>

      <p>
        Não é permitido: tentar acessar contas de outras pessoas, fazer engenharia reversa do
        aplicativo, sobrecarregar nossos servidores de propósito, ou usar o serviço pra qualquer
        finalidade ilegal.
      </p>

      <h2>6. Propriedade intelectual</h2>

      <p>
        A marca &quot;SeenList&quot;, o design e o código do aplicativo são de propriedade do
        responsável pelo serviço. Dados de filmes/séries exibidos vêm do TMDB e de outras fontes
        (AniList/MyAnimeList) sob os termos de uso dessas plataformas.
      </p>

      <h2>7. Isenção de garantias</h2>

      <p>
        O SeenList é oferecido &quot;como está&quot;. Não garantimos que o serviço estará sempre
        disponível, livre de erro, ou que os dados de filmes/séries (vindos de fontes externas)
        estarão sempre corretos ou atualizados.
      </p>

      <h2>8. Limitação de responsabilidade</h2>

      <p>
        Na máxima medida permitida por lei, o SeenList não se responsabiliza por danos indiretos
        decorrentes do uso (ou impossibilidade de uso) do serviço.
      </p>

      <h2>9. Suspensão e encerramento</h2>

      <p>
        Podemos suspender ou encerrar contas que violem estes termos, com ou sem aviso prévio,
        dependendo da gravidade. Você pode encerrar sua conta a qualquer momento (ver
        &quot;Como excluir sua conta&quot; na Política de Privacidade).
      </p>

      <h2>10. Alterações nestes termos</h2>

      <p>
        Podemos atualizar estes termos de tempos em tempos. O uso continuado do serviço após uma
        mudança significa que você aceita os novos termos.
      </p>

      <h2>11. Lei aplicável</h2>

      <p>
        Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa
        será resolvida no foro da comarca de Recife, estado de Pernambuco.
      </p>

      <h2>12. Contato</h2>

      <p>contato@seenlist.app</p>
    </main>
  );
}
