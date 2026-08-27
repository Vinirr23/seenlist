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
    <div className="min-h-dvh overflow-x-hidden bg-background">
      <AndroidAppPromoBanner />
      <YearInReviewModal />
      {children}

      <BottomNavigation />
    </div>
  );
}
