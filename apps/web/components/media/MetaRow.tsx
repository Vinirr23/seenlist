export function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  );
}
