import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function SectionPageHeader({ title, backHref = "/profile" }: { title: string; backHref?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 px-1">
      <Link
        href={backHref}
        aria-label="Voltar"
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
      >
        <ArrowLeft className="h-5 w-5" strokeWidth={2} />
      </Link>
      <h1 className="text-xl font-bold text-text">{title}</h1>
    </div>
  );
}
