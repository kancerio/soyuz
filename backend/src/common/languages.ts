// 27 кодов ISO 639-1, поддерживаемых AI-сервисом (docs/language_codes.md).
// Backend DTO и Frontend должны разрешать тот же список, иначе часть кодов
// будет отклоняться до запроса к AI-сервису.
export const SUPPORTED_LANGUAGES = [
  'ru',
  'en',
  'de',
  'fr',
  'es',
  'zh',
  'ar',
  'pt',
  'it',
  'nl',
  'pl',
  'uk',
  'tr',
  'ja',
  'ko',
  'hi',
  'fa',
  'sv',
  'da',
  'no',
  'fi',
  'cs',
  'el',
  'he',
  'id',
  'vi',
  'th',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value.toLowerCase())
  );
}

export function normalizeLanguage(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return isSupportedLanguage(normalized) ? normalized : null;
}

// Языки с письмом справа налево — для dir="rtl"/dir="auto" на клиенте.
export const RTL_LANGUAGES = ['ar', 'he', 'fa'] as const;
