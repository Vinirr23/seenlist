import { SeriesHome } from "@/components/series-home/SeriesHome";

/**
 * TASK-012 (refinamento): não usa o <PageContainer> compartilhado
 * aqui — ele tem px-4/pt-6 fixos, usados por várias outras telas, e
 * esta tela precisa de margens mais estreitas pra parecer com o TV
 * Time. Em vez de arriscar mudar o comportamento de outras telas
 * mexendo num componente compartilhado, o wrapper mais compacto fica
 * dentro de <SeriesHome> mesmo, só pra esta tela.
 */
export default function SeriesPage() {
  return <SeriesHome />;
}
