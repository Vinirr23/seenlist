import { MigrateFromTvTimeButton } from "@/components/tvtime-migration/MigrateFromTvTimeButton";

/**
 * TASK-035 — "descartar completamente o pipeline de migração
 * existente". Esta rota principal agora usa o pipeline novo
 * (lib/tvtime-migration), reescrito do zero. O antigo (TASK-027L,
 * lib/tvtime-out-import) continua existindo no código mas não é
 * mais chamado por aqui. O importador GDPR (compatibilidade)
 * continua existindo em /import/tvtime/gdpr (rota não removida, só
 * sem link daqui) — decisão explícita: deixar só a forma principal
 * visível nesta tela.
 */
export default function TvTimeImportPage() {
  return (
    <div>
      <MigrateFromTvTimeButton />
    </div>
  );
}
