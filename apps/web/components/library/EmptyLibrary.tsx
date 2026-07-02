import { EmptyState } from "../search/EmptyState";

export function EmptyLibrary({ message = "Nenhum título por aqui ainda." }: { message?: string }) {
  return <EmptyState message={message} />;
}
