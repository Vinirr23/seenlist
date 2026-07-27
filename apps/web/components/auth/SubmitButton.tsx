"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@seenlist/ui";
import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const { t } = useTranslation();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn(
        "w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background transition-opacity",
        "hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
    >
      {pending ? t("auth.pleaseWait") : children}
    </Button>
  );
}
