export function FormFeedback({ error, message }: { error?: string | null; message?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p role="status" className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
        {message}
      </p>
    );
  }
  return null;
}
