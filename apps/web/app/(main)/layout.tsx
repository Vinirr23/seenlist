import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { BetaPromoBanner } from "@/components/layout/BetaPromoBanner";

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
 * TASK-071 — `BetaPromoBanner` mora aqui (não em cada tela) por ser
 * chrome comum a todo o app logado, igual à `BottomNavigation`.
 *
 * TASK-014: largura total abaixo de 768px, coluna de ~430px
 * centralizada a partir daí — mesma regra do <PageContainer> e do
 * <BottomNavigation>, pra conteúdo/rodapé formarem uma coluna só.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <BetaPromoBanner />
      {children}

      <BottomNavigation />
    </div>
  );
}
