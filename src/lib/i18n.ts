import { defineI18n } from 'fumadocs-core/i18n';

export const locales = ['zh-tw', 'zh-cn', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'zh-tw';

export const i18n = defineI18n({
  languages: [...locales],
  defaultLanguage: defaultLocale,
  hideLocale: 'never',
  parser: 'dot',
  fallbackLanguage: null,
});

const htmlLanguages: Record<Locale, string> = {
  'zh-tw': 'zh-TW',
  'zh-cn': 'zh-CN',
  en: 'en',
};

const intlLanguages: Record<Locale, string> = {
  'zh-tw': 'zh-TW',
  'zh-cn': 'zh-CN',
  en: 'en-US',
};

const listSeparators: Record<Locale, string> = {
  'zh-tw': '、',
  'zh-cn': '、',
  en: ', ',
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function getHtmlLanguage(locale: Locale): string {
  return htmlLanguages[locale];
}

export function getIntlLocale(locale: Locale): string {
  return intlLanguages[locale];
}

export function getListSeparator(locale: Locale): string {
  return listSeparators[locale];
}

export function toLocalePath(locale: Locale, path = ''): string {
  const normalizedPath = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalizedPath}`;
}

export function suggestLocale(browserLanguages: readonly string[]): Locale {
  for (const language of browserLanguages) {
    const normalized = language.toLowerCase().replace('_', '-');
    if (normalized.startsWith('en')) return 'en';
    if (
      normalized === 'zh-cn' ||
      normalized.startsWith('zh-cn-') ||
      normalized === 'zh-hans' ||
      normalized.startsWith('zh-hans-') ||
      normalized === 'zh-sg' ||
      normalized.startsWith('zh-sg-') ||
      normalized === 'zh-my' ||
      normalized.startsWith('zh-my-')
    ) {
      return 'zh-cn';
    }
    if (
      normalized === 'zh-tw' ||
      normalized.startsWith('zh-tw-') ||
      normalized === 'zh-hant' ||
      normalized.startsWith('zh-hant-') ||
      normalized === 'zh-hk' ||
      normalized.startsWith('zh-hk-') ||
      normalized === 'zh-mo' ||
      normalized.startsWith('zh-mo-')
    ) {
      return 'zh-tw';
    }
    if (normalized.startsWith('zh')) return defaultLocale;
  }

  return defaultLocale;
}

export function getTranslationAvailability(
  locale: Locale,
  hasLocalizedPage: boolean,
  hasDefaultPage: boolean,
): 'available' | 'unavailable' | 'not-found' {
  if (hasLocalizedPage) return 'available';
  if (locale !== defaultLocale && hasDefaultPage) return 'unavailable';
  return 'not-found';
}
