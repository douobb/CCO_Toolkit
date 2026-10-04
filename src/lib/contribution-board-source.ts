import { source } from './source';
import {
  deriveContributionBoardItems,
  type ContributionBoardItem,
  type ContributionPagesByLocale,
  type ContributionSourcePage,
} from './contribution-board';
import { locales, type Locale } from './i18n';

function getSourcePages(locale: Locale): ContributionSourcePage[] {
  return source.getPages(locale).map((page) => ({
    locale,
    slugs: page.slugs,
    url: page.url,
    data: page.data,
  }));
}

export function getContributionBoard(locale: Locale): ContributionBoardItem[] {
  const pages: ContributionPagesByLocale = Object.fromEntries(
    locales.map((pageLocale) => [pageLocale, getSourcePages(pageLocale)]),
  ) as unknown as ContributionPagesByLocale;

  return deriveContributionBoardItems(pages, locale);
}
