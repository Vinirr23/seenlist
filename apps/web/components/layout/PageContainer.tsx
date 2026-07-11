import { cn } from "@seenlist/utils";

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * TASK-014: "o layout oficial do SeenList é o mobile — o desktop só
 * exibe isso centralizado". Abaixo de 768px, largura total (o app é
 * mobile, então isso já é o padrão). A partir de 768px, uma coluna
 * de ~430px centralizada — não um layout de desktop de verdade, só
 * o mesmo app mobile com espaço vazio nas laterais.
 */
export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("w-full px-4 pb-32 pt-6 md:mx-auto md:max-w-[430px]", className)}>
      {children}
    </div>
  );
}
