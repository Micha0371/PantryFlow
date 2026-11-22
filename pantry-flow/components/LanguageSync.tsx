import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useTranslation } from '@/lib/i18n';
import {
  clearPendingLanguage,
  fetchProfileLanguage,
  getPendingLanguage,
  saveProfileLanguage,
} from '@/lib/profile-language';

// Applies the signed-in account's language: a pending choice is written to the
// profile first, otherwise the profile language is read. Failures keep the
// current language, and a result for a previous user is never applied.
export function LanguageSync() {
  const { user } = useAuth();
  const { setLocale } = useTranslation();
  const userId = user?.id ?? null;
  const current = useRef<string | null>(userId);
  current.current = userId;

  useEffect(() => {
    if (!userId) return;
    const apply = (locale: Parameters<typeof setLocale>[0]) => {
      if (current.current === userId) setLocale(locale);
    };
    void (async () => {
      try {
        const pending = await getPendingLanguage(userId);
        if (pending) {
          try {
            await saveProfileLanguage(userId, pending);
            await clearPendingLanguage(userId);
          } catch {
            // Kept pending; retried at the next sign-in.
          }
          apply(pending);
          return;
        }
        const language = await fetchProfileLanguage(userId);
        if (language) apply(language);
      } catch {
        // Offline or unavailable: keep the current language.
      }
    })();
  }, [userId, setLocale]);

  return null;
}
