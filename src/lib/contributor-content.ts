import {
  isPublishedContributionRecord,
  isValidContributorContentPath,
  type AcceptedContributionRecord,
  type ContributorRecordView,
  type ContributorContentTarget,
} from './site-content';
import { defaultLocale, type Locale } from './i18n';

/** 由內容來源 adapter 提供的最小頁面資訊，避免純 resolver 依賴 Fumadocs 型別。 */
export interface ContributorContentPage {
  path: string;
  locale: Locale;
  href: string;
  title: string;
}

/**
 * 依目前語系解析 contentPath；找不到目前語系時依序使用預設語系與其他實際存在頁面。
 * 回傳的 href 與 locale 一律來自實際頁面，因此不會為不存在的內容產生連結。
 */
export function resolveContributorContentPath(
  locale: Locale,
  contentPath: string,
  pages: readonly ContributorContentPage[],
): ContributorContentTarget | undefined {
  if (!isValidContributorContentPath(contentPath)) return undefined;

  const candidateLocales = [
    locale,
    defaultLocale,
    ...pages.map((page) => page.locale),
  ].filter((candidateLocale, index, values) => values.indexOf(candidateLocale) === index);

  for (const candidateLocale of candidateLocales) {
    const page = pages.find(
      (candidate) => candidate.path === contentPath && candidate.locale === candidateLocale,
    );
    if (!page || !page.href) continue;

    return {
      contentPath,
      locale: page.locale,
      href: page.href,
      title: page.title || contentPath,
    };
  }

  return undefined;
}

function resolveContributorContentPathForLocale(
  locale: Locale,
  contentPath: string,
  pages: readonly ContributorContentPage[],
): ContributorContentTarget | undefined {
  if (!isValidContributorContentPath(contentPath)) return undefined;

  const page = pages.find(
    (candidate) => candidate.path === contentPath && candidate.locale === locale,
  );
  if (!page?.href) return undefined;

  return {
    contentPath,
    locale: page.locale,
    href: page.href,
    title: page.title || contentPath,
  };
}

export function resolveContributorRecordViews(
  locale: Locale,
  records: readonly AcceptedContributionRecord[],
  pages: readonly ContributorContentPage[],
): ContributorRecordView[] {
  return records.filter(isPublishedContributionRecord).map((record) => {
    const target = record.contentPath
      ? record.locale
        ? resolveContributorContentPathForLocale(record.locale, record.contentPath, pages)
        : resolveContributorContentPath(locale, record.contentPath, pages)
      : undefined;

    return {
      record,
      ...(target ? { target } : {}),
    };
  });
}
