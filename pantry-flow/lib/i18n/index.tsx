import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, TranslationKey } from './en';
import { de } from './de';
import * as Localization from 'expo-localization';
import { defaultLocale, isLocale, type Locale } from '../language';

const STORAGE_KEY = 'user_language';

const translations: Record<Locale, Record<string, string>> = { en, de };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    defaultLocale(process.env.EXPO_PUBLIC_DEFAULT_LOCALE, Localization.getLocales())
  );

  // An explicit setLocale() wins over the stored value that is still being read.
  const explicit = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (isLocale(saved) && !explicit.current) {
        setLocaleState(saved);
      }
    });
  }, []);

  const setLocale = useCallback((next: Locale) => {
    explicit.current = true;
    setLocaleState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[locale][key] ?? translations.en[key] ?? key;
    },
    [locale]
  );

  // Consumers re-render only when the locale changes (KAN-27).
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return ctx;
}
