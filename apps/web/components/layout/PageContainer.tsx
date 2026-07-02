import { cn } from "@seenlist/utils";

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-2xl px-4 pb-24 pt-6", className)}>{children}</div>
  );
}
