import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { AndroidAppPromoBanner } from "@/components/layout/AndroidAppPromoBanner";
import { YearInReviewModal } from "@/components/profile/YearInReviewModal";

/**
 * Layout principal — para onde o usuário vai depois do login. Só
 * chrome (navegação fixa), nenhuma tela de produto mora aqui, só o
 * wrapper em volta de /series /movies /explore /profile.
 *
 * TASK-070 — a barra do topo ("SeenList" + botão de sair) saiu: era
 * redundante com a barra de navegação inferior (já diz em qual seção
 * a pessoa está) e com o botão "Sair" de verdade, que já existe
 * dentro de Configurações — ter os dois ao mesmo tempo também
 * empurrava o conteúdo de cada tela pra baixo sem necessidade (a
 * capa do Perfil, por exemplo, devia começar bem no topo da tela).
 *
 * `BetaPromoBanner` (o pop-up "Participe do nosso beta!") removido
 * antes — a fase de convite/teste fechado do Android já não fazia
 * mais sentido. No lugar dele, a pedido: `AndroidAppPromoBanner`,
 * anunciando que o app já está disponível pra valer na Play Store.
 *
 * `YearInReviewModal` (a pedido, "Seu ano") — só se torna visível
 * de verdade em dezembro/janeiro (ver o componente). Risco baixo,
 * mas registrado: como os dois popups usam `position: fixed inset-0`
 * com o mesmo z-index, se algum dia os dois estiverem "não
 * dispensados" ao mesmo tempo bem em janeiro, um ficaria por cima do
 * outro sem hierarquia definida — não resolvido de propósito agora,
 * já que a chance real disso acontecer é baixa (a maioria de quem
 * usa o app já dispensou o banner do Android há tempo).
 *
 * TASK-014: largura total abaixo de 768px, coluna de ~430px
 * centralizada a partir daí — mesma regra do <PageContainer> e do
 * <BottomNavigation>, pra conteúdo/rodapé formarem uma coluna só.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    // `overflow-x-hidden` (a pedido — "limite estranho" no brilho azul
    // do vidro do Perfil, ver ProfileView.tsx): trava de segurança
    // contra rolagem horizontal, adicionada aqui pra permitir tirar o
    // `overflow-hidden` LOCAL da camada de brilho, que era o que
    // criava o corte reto na borda da coluna central em telas largas
    // — sem essa trava aqui em cima, tirar o corte local arriscaria
    // criar uma barra de rolagem horizontal de verdade no celular
    // (onde a coluna já ocupa a tela toda e o brilho vaza um pouco
    // pra fora dela).
    //
    // CAUSA RAIZ DA "BARRA DE ROLAGEM DUPLICADA" (2026-08-27, achado
    // via diagnóstico no console do navegador) — regra pouco
    // conhecida do CSS: quando um dos dois eixos de rolagem
    // (`overflow-x`/`overflow-y`) tem um valor "de verdade" (`hidden`,
    // como o `overflow-x-hidden` acima) e o outro está `visible`, o
    // navegador FORÇA esse outro eixo a virar `auto` — mesmo que
    // alguém escreva `visible` explicitamente nele (uma 1ª tentativa
    // de correção, `overflow-y-visible`, não resolveu por exatamente
    // esse motivo: a regra ignora esse valor escrito à mão e recalcula
    // `auto` de qualquer jeito, confirmado rodando
    // `getComputedStyle(el).overflowY` e vendo `"auto"` mesmo com a
    // classe `overflow-y-visible` presente). Resultado: essa `<div>`,
    // que envolve TODAS as telas do app, virava uma SEGUNDA área com
    // rolagem vertical própria (além da rolagem normal da página
    // inteira) — as duas competindo pelo mesmo gesto de rolagem
    // geravam a segunda barra e a necessidade de rolar várias vezes
    // pra a tela responder. Só aparecia de forma visível em Séries
    // porque é a única tela cujo conteúdo muda de altura com
    // frequência.
    //
    // CORREÇÃO DE VERDADE — existe um único valor que escapa dessa
    // regra: `clip`, em vez de `hidden`. Funcionalmente equivalente
    // pro que essa trava sempre precisou fazer (impedir rolagem
    // horizontal), só que sem disparar o gatilho que força o eixo
    // vertical a virar `auto` — `clip` conta como "inofensivo" pra
    // essa regra, igual `visible`, então o outro eixo (`overflow-y`)
    // permanece genuinamente `visible`, sem segunda área de rolagem.
    <div className="min-h-dvh overflow-x-clip bg-background">
      <AndroidAppPromoBanner />
      <YearInReviewModal />
      {children}

      <BottomNavigation />
    </div>
  );
}
