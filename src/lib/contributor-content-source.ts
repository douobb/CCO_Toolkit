import { locales, type Locale } from './i18n';
import {
  resolveContributorRecordViews,
  resolveContributorContentPath,
  type ContributorContentPage,
} from './contributor-content';
import type {
  AcceptedContributionRecord,
  ContributorContentTarget,
  ContributorRecordView,
} from './site-content';
import { source } from './source';

/** 將 Fumadocs source 轉成 resolver 所需的最小內容頁資料。 */
export function getContributorContentPages(): ContributorContentPage[] {
  return locales.flatMap((locale) =>
    source.getPages(locale).map((page) => ({
      path: page.slugs.join('/'),
      locale,
      href: page.url,
      title: page.data.title ?? page.slugs.at(-1) ?? page.slugs.join('/'),
    })),
  );
}

export function resolveLocalizedContributorContent(
  locale: Locale,
  contentPath: string,
): ContributorContentTarget | undefined {
  return resolveContributorContentPath(locale, contentPath, getContributorContentPages());
}

export function getContributorRecordViews(
  locale: Locale,
  records: readonly AcceptedContributionRecord[],
): ContributorRecordView[] {
  return resolveContributorRecordViews(locale, records, getContributorContentPages());
}
