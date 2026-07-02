export interface ScreenHeaderProps {
  title: string;
  description?: string;
}

export function ScreenHeader({ title, description }: ScreenHeaderProps) {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold text-text">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </header>
  );
}
