import Link from "next/link";
import { MigrateFromTvTimeButton } from "@/components/tvtime-migration/MigrateFromTvTimeButton";

/**
 * TASK-035 — "descartar completamente o pipeline de migração
 * existente". Esta rota principal agora usa o pipeline novo
 * (lib/tvtime-migration), reescrito do zero. O antigo (TASK-027L,
 * lib/tvtime-out-import) continua existindo no código mas não é
 * mais chamado por aqui. O importador GDPR (compatibilidade)
 * continua intocado em /import/tvtime/gdpr.
 */
export default function TvTimeImportPage() {
  return (
    <div>
      <MigrateFromTvTimeButton />
      <p className="mx-auto max-w-sm px-6 pb-8 text-center text-xs text-muted">
        Não consegue instalar a extensão?{" "}
        <Link href="/import/tvtime/gdpr" className="underline">
          Importar pelo arquivo do GDPR
        </Link>{" "}
        (modo de compatibilidade).
      </p>
    </div>
  );
}
