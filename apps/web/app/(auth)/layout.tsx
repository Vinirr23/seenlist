export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-semibold tracking-wide text-text">SeenList</p>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-lg shadow-black/20">
          {children}
        </div>
      </div>
    </main>
  );
}
