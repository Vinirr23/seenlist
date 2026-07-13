import { useEffect, useState } from "react";
import {
  fetchNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreferences,
} from "./notificationPreferences";

const DEFAULTS: NotificationPreferences = {
  episodeNew: true,
  seasonPremiere: true,
  commentReply: true,
  commentLike: true,
  reviewLike: true,
};

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [savingField, setSavingField] = useState<keyof NotificationPreferences | null>(null);

  useEffect(() => {
    fetchNotificationPreferences()
      .then(setPreferences)
      .catch((error) => console.error("[useNotificationPreferences] Falha ao buscar preferências", error))
      .finally(() => setIsLoading(false));
  }, []);

  async function setField(field: keyof NotificationPreferences, value: boolean) {
    const previous = preferences[field];
    setSavingField(field);
    setPreferences((current) => ({ ...current, [field]: value })); // otimista

    try {
      await updateNotificationPreference(field, value);
    } catch (error) {
      console.error("[useNotificationPreferences] Falha ao salvar preferência", error);
      setPreferences((current) => ({ ...current, [field]: previous }));
    } finally {
      setSavingField(null);
    }
  }

  return { preferences, isLoading, savingField, setField };
}
