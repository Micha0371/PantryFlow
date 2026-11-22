export type Locale = 'en' | 'de';

type PhoneLocale = { languageCode: string | null };

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'de';
}

// German (any region) only when it is the phone's first language; everything else is English.
export function phoneLocale(locales: ReadonlyArray<PhoneLocale>): Locale {
  return locales[0]?.languageCode === 'de' ? 'de' : 'en';
}

// A valid build-time override wins; otherwise follow the phone.
export function defaultLocale(override: string | undefined, locales: ReadonlyArray<PhoneLocale>): Locale {
  return isLocale(override) ? override : phoneLocale(locales);
}
