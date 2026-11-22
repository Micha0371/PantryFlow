// The e2e flows assert English text, so test builds pin English unless the
// owner's phone-language check (PANTRY_TEST_LOCALE=phone) is requested.
export function e2eLocaleEnv(testLocale: string | undefined): Record<string, string> {
  return testLocale === 'phone' ? {} : { EXPO_PUBLIC_DEFAULT_LOCALE: 'en' };
}
