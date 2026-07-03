export function InlineError({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <p role="alert" className="text-[11px] text-danger">
      Não foi possível salvar agora. Tente de novo.
    </p>
  );
}
