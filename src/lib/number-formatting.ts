import { getHtmlLanguage, type Locale } from './i18n';

export type NumberFormatter = (
  value: number,
  options?: Intl.NumberFormatOptions,
) => string;

/** 依目前頁面語系建立數字 formatter；工具也可以注入自己的 formatter。 */
export function createNumberFormatter(locale: Locale): NumberFormatter {
  return (value, options) =>
    new Intl.NumberFormat(getHtmlLanguage(locale), options).format(value);
}
