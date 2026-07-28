"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Check, Bug, Lightbulb, MessageSquare } from "lucide-react";
import { cn } from "@seenlist/utils";
import { useSendFeedback, type FeedbackType } from "@/lib/queries/feedback";
import { hapticTick } from "@/lib/haptics";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const TYPE_VALUES: { value: FeedbackType; icon: typeof Bug }[] = [
  { value: "bug", icon: Bug },
  { value: "suggestion", icon: Lightbulb },
  { value: "other", icon: MessageSquare },
];

/**
 * TASK-076 — canal de feedback dentro do próprio app, pros
 * testadores da beta relatarem bug/sugestão sem precisar de
 * WhatsApp/e-mail avulso. Guarda em `user_feedback` (migration
 * 20260813000000) — sem tela de leitura no app ainda, é consultado
 * direto pelo Supabase por enquanto.
 */
export function FeedbackView() {
  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const sendFeedback = useSendFeedback();
  const { t } = useTranslation();

  const TYPE_LABEL_KEYS: Record<FeedbackType, string> = {
    bug: "settings.feedback.foundBug",
    suggestion: "settings.feedback.haveSuggestion",
    other: "settings.feedback.other",
  };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    hapticTick();
    sendFeedback.mutate(
      { type, message: trimmed },
      {
        onSuccess: () => {
          setMessage("");
          setSent(true);
        },
      }
    );
  }

  return (
    <div className="w-full px-4 pb-32 pt-4 md:mx-auto md:max-w-[430px]">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/profile/settings"
          aria-label={t("common.back")}
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-text"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-xl font-bold text-text">{t("settings.sendFeedback")}</h1>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check className="h-6 w-6" strokeWidth={2.5} />
          </div>
          <p className="text-sm font-semibold text-text">{t("settings.feedback.sentThanks")}</p>
          <p className="text-xs text-muted">{t("settings.feedback.helpsBeta")}</p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-2 text-xs font-medium text-primary underline"
          >
            {t("settings.feedback.sendAnother")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("settings.feedback.aboutWhat")}</p>
            <div className="flex flex-col gap-2">
              {TYPE_VALUES.map((option) => {
                const selected = type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-text"
                    )}
                  >
                    <option.icon className="h-4 w-4" strokeWidth={2} />
                    {t(TYPE_LABEL_KEYS[option.value])}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="feedback-message" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
              {t("settings.feedback.tellDetails")}
            </label>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder={t("settings.feedback.placeholder")}
              className="w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-right text-xs text-muted">{message.length}/2000</p>
          </div>

          <button
            type="submit"
            disabled={!message.trim() || sendFeedback.isPending}
            className="w-full rounded-lg bg-primary py-3 text-sm font-bold text-background disabled:opacity-40"
          >
            {sendFeedback.isPending ? t("settings.feedback.sending") : t("settings.sendFeedback")}
          </button>
        </form>
      )}
    </div>
  );
}
