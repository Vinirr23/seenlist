import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface BottomNavigationItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** TASK-169 — bolinha de aviso (recomendações não lidas, por enquanto só usado na aba Perfil). */
  badge?: boolean;
}

export function BottomNavigationItem({
  href,
  label,
  icon: Icon,
  active = false,
  badge = false,
}: BottomNavigationItemProps) {
  const { t } = useTranslation();
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Compactação (2026-08-26, a pedido) — `gap-1` (4px) → `gap-[3px]`,
      // uma redução leve no espaço vertical entre ícone e legenda; o
      // ícone (`h-5 w-5`) e o texto (`text-[10px]`) continuam do
      // mesmo tamanho, só o respiro entre os dois diminuiu um pouco.
      //
      // Compactação nº2 (2026-08-26, a pedido — "aproxime ligeiramente
      // cada ícone da sua legenda") — `gap-[3px]` → `gap-[2px]`, mais um
      // passo pequeno na mesma direção. Ícone e texto continuam do
      // mesmo tamanho de sempre.
      className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[2px] py-2.5"
    >
      {/*
        * A PEDIDO — a cápsula que desliza (renderizada em
        * `BottomNavigation.tsx`, por trás de todos os itens) passou
        * a ser o ÚNICO indicador de aba ativa. O círculo individual
        * que cada ícone tinha (`bg-primary/15` só nele) foi removido
        * — os dois juntos ficariam redundantes, dois destaques
        * dizendo a mesma coisa. `z-10` no link garante que o ícone
        * fique por CIMA da cápsula (que não tem z-index próprio),
        * não escondido atrás dela.
        */}
      {/*
        * "Floating Glass Dock" (2026-08-26, ajuste final — proposta
        * trazida pelo usuário, originada de outra IA — "GPT") — a
        * cápsula sólida por trás (BottomNavigation.tsx) virou um brilho
        * âmbar suave + um traço fino embaixo, sem fundo sólido — por
        * isso ícone/texto ativo voltam a ser `text-primary` (âmbar),
        * já que não tem mais nenhum fundo âmbar chapado por baixo pra
        * competir com a cor. Ícone inativo ganhou `/70` de opacidade
        * (pedido explícito — "60–70% de opacidade" no estado inativo,
        * pra reforçar o contraste com o ativo a 100%).
        */}
      {/*
        * CAUSA RAIZ do "ícone e legenda longe um do outro" (2026-08-26,
        * a pedido — "eu disse explicitamente pra deixar o ícone e a
        * legenda juntos") — o `gap-[3px]` (acima) já estava certo, mas
        * essa caixa em volta do ícone era `h-9 w-9` (36×36px) só pra
        * dar espaço de toque e posicionar a bolinha de aviso no canto;
        * o ÍCONE de verdade é `h-5 w-5` (20px), então sobravam 8px de
        * espaço VAZIO e invisível embaixo do ícone antes mesmo do
        * `gap-[3px]` entrar em ação — a legenda ficava ~11px do ícone
        * na prática, não 3px. `h-9 w-9` → `h-6 w-6` (24px) fecha a
        * maior parte desse vazio (sobra só 2px), deixando ícone e
        * legenda visivelmente colados, com a bolinha de aviso ainda
        * espiando no canto sem grudar no ícone.
        */}
      <span className="relative flex h-6 w-6 items-center justify-center">
        <Icon
          className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted/70")}
          strokeWidth={active ? 2.4 : 2}
        />
        {badge && (
          <span
            aria-label={t("nav.unreadNotifications")}
            className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface"
          />
        )}
      </span>
      <span className={cn("text-[10px]", active ? "font-semibold text-primary" : "text-muted")}>
        {label}
      </span>
    </Link>
  );
}
