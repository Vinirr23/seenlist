import Image from "next/image";
import { AuthLanguageSwitcher } from "@/components/auth/AuthLanguageSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-background px-4">
      <AuthLanguageSwitcher />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Image src="/logo.png" alt="SeenList" width={64} height={64} className="rounded-xl" priority />
          <p className="text-center font-semibold tracking-wide text-text">SeenList</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-lg shadow-black/20">
          {children}
        </div>
      </div>
    </main>
  );
}
