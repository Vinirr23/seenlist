import { TvTimeImportWizard } from "@/components/tvtime-import/TvTimeImportWizard";

/**
 * TASK-027L — "o importador GDPR poderá permanecer apenas como
 * compatibilidade para usuários que não conseguirem utilizar a
 * extensão". Deixou de ser a rota principal (/import/tvtime), mas o
 * fluxo inteiro continua funcionando exatamente como antes aqui.
 */
export default function TvTimeGdprImportPage() {
  return <TvTimeImportWizard />;
}
