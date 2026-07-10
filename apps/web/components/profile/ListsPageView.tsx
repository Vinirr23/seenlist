import { SectionPageHeader } from "./SectionPageHeader";
import { ListsView } from "./ListsView";

export function ListsPageView() {
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title="Minhas listas" />
      <ListsView />
    </div>
  );
}
