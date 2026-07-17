import { TvTimeImportWizard } from "@/components/tvtime-import/TvTimeImportWizard";

/**
 * TASK-166 — troca deliberada de volta pro importador GDPR
 * (lib/tvtime-import, TASK-027) como fluxo PRINCIPAL, substituindo o
 * baseado na extensão "TV Time Out" (lib/tvtime-migration, TASK-035)
 * que estava aqui. Motivo: testado contra um export real do usuário
 * (307 séries, os 7 arquivos esperados todos presentes, lógica de
 * status coerente) e não exige instalar extensão nenhuma — só
 * upload do .zip do GDPR, que qualquer usuário do TV Time consegue
 * pedir direto no app deles, sem depender do navegador ser Chrome
 * nem de extensão nenhuma instalada.
 *
 * `MigrateFromTvTimeButton`/`lib/tvtime-migration` (extensão) e o
 * botão de tutorial em vídeo que ele tinha não são mais usados aqui
 * — não apagados do código, só sem rota principal apontando pra
 * eles. `/import/tvtime/gdpr` continua existindo como rota separada
 * (mesmo componente `TvTimeImportWizard`, agora duplicado aqui e lá
 * — não removido de propósito, indiferente qual delas o usuário
 * usa).
 */
export default function TvTimeImportPage() {
  return <TvTimeImportWizard />;
}
