import type { Metadata } from "next";

// SEO (2026-09-04) — mesmo motivo/correção do `app/about/page.tsx`
// (ver comentário lá): sem `alternates.canonical` próprio, herdava o
// canonical fixo da home definido em `app/layout.tsx`, e o Google
// nunca indexaria esta página como própria.
export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Como o SeenList coleta, usa e protege seus dados, em conformidade com a LGPD.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 prose">
      <h1>Política de Privacidade</h1>

      <p>Última atualização: 5 de agosto de 2026</p>

      <p>
        O SeenList (&quot;nós&quot;, &quot;aplicativo&quot;, &quot;serviço&quot;) é um aplicativo de
        acompanhamento de séries e filmes. Esta política explica quais dados coletamos, por quê,
        e quais direitos você tem sobre eles, em conformidade com a Lei Geral de Proteção de
        Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <h2>1. Quem somos</h2>

      <p>
        O SeenList é operado por Vinicius Ribeiro, CPF 110.617.984-61. Em caso de dúvida sobre
        esta política ou sobre seus dados, entre em contato pelo e-mail{" "}
        <strong>contato@seenlist.app</strong>.
      </p>

      <h2>2. Quais dados coletamos</h2>

      <p><strong>Dados que você nos fornece diretamente:</strong></p>
      <ul>
        <li>
          Nome, e-mail e senha (quando o cadastro é feito por e-mail) — a senha nunca é
          armazenada em texto puro, só um hash criptográfico.
        </li>
        <li>
          Nome, e-mail e foto de perfil, quando o cadastro é feito com login do Google —
          recebemos só o que o Google compartilha com apps conectados, nunca sua senha do Google.
        </li>
        <li>Nome de usuário, nome de exibição, foto de perfil, banner e biografia, se você escolher preenchê-los.</li>
        <li>Idioma de preferência.</li>
      </ul>

      <p><strong>Dados gerados pelo uso do aplicativo:</strong></p>
      <ul>
        <li>Sua biblioteca de séries e filmes (assistindo, concluído, pausado ou quer assistir).</li>
        <li>Episódios individuais marcados como assistidos, com data e hora.</li>
        <li>Avaliações (nota e texto, quando você escreve uma).</li>
        <li>Posts, comentários, curtidas, respostas e denúncias que você fizer no Feed.</li>
        <li>Listas personalizadas que você criar.</li>
        <li>Quem você segue e quem te segue.</li>
        <li>Recomendações de título que você enviar ou receber de outras pessoas.</li>
        <li>Suas preferências de privacidade (quem pode ver seu perfil, sua biblioteca e seus favoritos).</li>
      </ul>

      <p><strong>Dados técnicos:</strong></p>
      <ul>
        <li>
          Token de notificação push do seu aparelho (só se você permitir notificações) — usado
          exclusivamente pra te avisar de episódio novo das séries que você acompanha.
        </li>
        <li>
          Endereço IP e informações básicas do dispositivo/navegador, coletados automaticamente
          pela infraestrutura que hospeda o serviço.
        </li>
        <li>No site, um cookie de sessão (httpOnly, não acessível por script) pra manter você logado.</li>
        <li>
          Histórico das suas últimas buscas dentro do app — fica salvo só no seu próprio
          aparelho (nunca enviado pros nossos servidores), e você pode apagar item por item
          quando quiser.
        </li>
      </ul>

      <p><strong>Dados processados temporariamente, de fontes externas que você escolhe conectar:</strong></p>
      <ul>
        <li>
          <strong>Importação do Trakt.tv:</strong> ao autorizar, usamos um token de acesso de
          curta duração (15 minutos) só pra buscar seu histórico uma vez e importar pra sua
          biblioteca — não fazemos sincronização contínua, e o token não é guardado depois disso.
        </li>
        <li>
          <strong>Importação do TV Time:</strong> você mesmo envia um arquivo de exportação de
          dados (gerado pelo próprio TV Time); usamos esse arquivo só pra importar sua
          biblioteca, uma vez, e não o armazenamos depois de processado.
        </li>
      </ul>

      <p>
        <strong>O que NÃO coletamos:</strong> não pedimos nem armazenamos dados de pagamento (o
        SeenList não tem nenhuma cobrança hoje), nem informações sensíveis como dados de saúde,
        biometria, opinião política ou religiosa.
      </p>

      <h2>3. Por que usamos esses dados (base legal, conforme a LGPD)</h2>

      <ul>
        <li>
          <strong>Execução de contrato</strong> (art. 7º, V) — pra criar e manter sua conta,
          sincronizar sua biblioteca entre aparelhos, e fazer as funcionalidades sociais
          funcionarem.
        </li>
        <li>
          <strong>Legítimo interesse</strong> (art. 7º, IX) — pra manter o serviço seguro,
          prevenir abuso e melhorar o aplicativo.
        </li>
        <li>
          <strong>Consentimento</strong> (art. 7º, I) — pra notificação push e pra importação de
          dados de terceiros (Trakt, TV Time).
        </li>
      </ul>

      <h2>4. Com quem compartilhamos dados</h2>

      <p>
        O SeenList não vende dado pessoal, nunca. Alguns provedores de infraestrutura processam
        dado em nosso nome, só pra operar o serviço:
      </p>

      <table>
        <thead>
          <tr>
            <th>Provedor</th>
            <th>Papel</th>
            <th>Que dado passa por lá</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Banco de dados, login, armazenamento de arquivo, mensagens em tempo real</td>
            <td>Praticamente todo dado da conta</td>
          </tr>
          <tr>
            <td>TMDB (The Movie Database)</td>
            <td>Fonte dos dados de filmes/séries</td>
            <td>Só o termo que você busca — nenhum dado pessoal</td>
          </tr>
          <tr>
            <td>AniList / MyAnimeList</td>
            <td>Foto de personagem de anime, quando aplicável</td>
            <td>Só o título da série — nenhum dado pessoal</td>
          </tr>
          <tr>
            <td>Google</td>
            <td>Login social (opcional)</td>
            <td>Confirmação de identidade via OAuth</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hospedagem do site</td>
            <td>Tráfego normal de navegação</td>
          </tr>
          <tr>
            <td>Expo</td>
            <td>Envio de notificação push (app mobile)</td>
            <td>Token de notificação do seu aparelho</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Envio de e-mail (ex.: recuperação de senha)</td>
            <td>Seu e-mail, só quando necessário</td>
          </tr>
        </tbody>
      </table>

      <p>
        Todos esses provedores têm suas próprias políticas de privacidade, e processam dado só na
        medida do necessário pra prestar o serviço contratado por nós.
      </p>

      <p>
        Hoje, a infraestrutura principal (banco de dados) está hospedada fora do Brasil (Estados
        Unidos). Isso pode mudar no futuro; se mudar, esta política será atualizada.
      </p>

      <h2>5. Visibilidade dos seus dados por outros usuários</h2>

      <p>
        Você controla, nas configurações, quem pode ver seu perfil, sua biblioteca e seus
        favoritos: público, só quem te segue, ou privado. Você pode apagar qualquer post,
        comentário ou avaliação que tiver feito, a qualquer momento.
      </p>

      <h2>6. Por quanto tempo guardamos seus dados</h2>

      <p>
        Seus dados ficam guardados enquanto sua conta existir. Se você excluir sua conta, seus
        dados pessoais e o conteúdo que você criou são apagados ou tornados anônimos, exceto
        quando a lei exigir que guardemos algo por mais tempo.
      </p>

      <h2>7. Como excluir sua conta</h2>

      <p>Consulte:</p>
      <p>https://seenlist.app/delete-account</p>

      <h2>8. Seus direitos como titular dos dados (LGPD, art. 18)</h2>

      <p>Você tem direito a, a qualquer momento:</p>
      <ul>
        <li>Confirmar se tratamos algum dado seu, e ter acesso a ele.</li>
        <li>Corrigir dado incompleto, incorreto ou desatualizado.</li>
        <li>Pedir anonimização, bloqueio ou eliminação de dado desnecessário.</li>
        <li>Portar seus dados pra outro fornecedor de serviço.</li>
        <li>Eliminar os dados tratados com seu consentimento.</li>
        <li>Saber com quem compartilhamos seu dado.</li>
        <li>Revogar consentimento a qualquer momento.</li>
      </ul>

      <p>Pra exercer qualquer um desses direitos, escreva pra contato@seenlist.app.</p>

      <h2>9. Segurança</h2>

      <p>
        Toda comunicação entre o aplicativo e nossos servidores usa HTTPS/TLS. O banco de dados
        usa controle de acesso por linha (Row Level Security). Sua senha nunca é armazenada em
        texto legível.
      </p>

      <h2>10. Menores de idade</h2>

      <p>
        A idade mínima pra usar o SeenList é 16 (dezesseis) anos. Se tomarmos conhecimento de que
        uma criança abaixo da idade mínima criou uma conta, ela será removida.
      </p>

      <h2>11. Mudanças nesta política</h2>

      <p>
        Podemos atualizar esta política de tempos em tempos. Mudanças relevantes serão avisadas
        dentro do aplicativo. A data no topo desta página sempre mostra a versão mais recente.
      </p>

      <h2>12. Contato</h2>

      <p>contato@seenlist.app</p>
    </main>
  );
}
