import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { BottomNavigation } from "@/components/layout/BottomNavigation";

/**
 * Layout principal — para onde o usuário vai depois do login. Só
 * chrome (topo mínimo + navegação fixa), nenhuma tela de produto
 * mora aqui, só o wrapper em volta de /series /movies /explore
 * /profile.
 */
export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold tracking-wide text-text">SeenList</span>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sair"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
          </button>
        </form>
      </header>

      {children}

      <BottomNavigation />
    </div>
  );
}
