import { defaultLocale, getIntlLocale, toLocalePath, type Locale } from './i18n';
import { blogSource } from './source';

export type BlogPage = (typeof blogSource)['$inferPage'];

export type BlogListItem =
  | { kind: 'available'; page: BlogPage }
  | { kind: 'unavailable'; page: BlogPage; sourcePage: BlogPage };

export function getBlogPages(locale: Locale): BlogPage[] {
  return blogSource
    .getPages(locale)
    .filter((page) => page.slugs[0] === 'blog' && page.slugs.length > 1)
    .sort((a, b) => {
      const dateDifference = (getBlogDate(b)?.getTime() ?? 0) - (getBlogDate(a)?.getTime() ?? 0);
      if (dateDifference !== 0) return dateDifference;

      return a.data.title.localeCompare(b.data.title, getIntlLocale(locale));
    });
}

export function getBlogPage(locale: Locale, slug: string) {
  return blogSource.getPage(['blog', slug], locale);
}

export function getBlogSlug(page: BlogPage): string {
  const slug = page.slugs.at(-1);
  if (!slug) throw new Error(`Blog 頁面缺少有效 slug：${page.url}`);
  return slug;
}

/** 非預設語系列表保留預設語系文章入口，讓尚未翻譯的文章仍可被發現。 */
export function getBlogListItems(locale: Locale): BlogListItem[] {
  const localizedPages = getBlogPages(locale);
  if (locale === defaultLocale) {
    return localizedPages.map((page) => ({ kind: 'available' as const, page }));
  }

  const sourcePages = getBlogPages(defaultLocale);
  const localizedBySlug = new Map(localizedPages.map((page) => [getBlogSlug(page), page]));
  const sourceSlugs = new Set(sourcePages.map(getBlogSlug));
  const items: BlogListItem[] = sourcePages.map((sourcePage) => {
    const localizedPage = localizedBySlug.get(getBlogSlug(sourcePage));
    return localizedPage
      ? { kind: 'available' as const, page: localizedPage }
      : { kind: 'unavailable' as const, page: sourcePage, sourcePage };
  });

  for (const page of localizedPages) {
    if (!sourceSlugs.has(getBlogSlug(page))) {
      items.push({ kind: 'available', page });
    }
  }

  return items.sort((a, b) => {
    const dateDifference =
      (getBlogDate(b.page)?.getTime() ?? 0) - (getBlogDate(a.page)?.getTime() ?? 0);
    if (dateDifference !== 0) return dateDifference;

    return a.page.data.title.localeCompare(b.page.data.title, getIntlLocale(locale));
  });
}

export function getBlogPageUrl(locale: Locale, page: BlogPage): string {
  return toLocalePath(locale, `blog/${getBlogSlug(page)}`);
}

export function getBlogDate(page: BlogPage): Date | undefined {
  const value = page.data.date;
  if (!value) return undefined;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function getBlogDateTime(page: BlogPage): string | undefined {
  return getBlogDate(page)?.toISOString().slice(0, 10);
}

export function formatBlogDate(page: BlogPage, locale: Locale): string | undefined {
  return getBlogDate(page)?.toLocaleDateString(getIntlLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
