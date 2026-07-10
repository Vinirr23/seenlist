import { LogOut } from "lucide-react";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { BottomNavigation } from "@/components/layout/BottomNavigation";

/**
 * Layout principal — para onde o usuário vai depois do login. Só
 * chrome (topo mínimo + navegação fixa), nenhuma tela de produto
 * mora aqui, só o wrapper em volta de /series /movies /explore
 * /profile.
 *
 * TASK-014: largura total abaixo de 768px, coluna de ~430px
 * centralizada a partir daí — mesma regra do <PageContainer> e do
 * <BottomNavigation>, pra topo/conteúdo/rodapé formarem uma coluna só.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="flex w-full items-center justify-between border-b border-border px-4 py-3 md:mx-auto md:max-w-[430px]">
        <span className="text-sm font-semibold tracking-wide text-text">SeenList</span>
        <LogoutButton
          className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-text"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
        </LogoutButton>
      </header>

      {children}

      <BottomNavigation />
    </div>
  );
}
