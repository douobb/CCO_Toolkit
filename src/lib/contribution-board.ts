import { contentSections, type ContentSection } from './content-sections';
import { defaultLocale, locales, type Locale } from './i18n';

export type ContributionKind = 'incomplete' | 'translation';

export type ContributionSourcePage = {
  readonly locale: Locale;
  readonly slugs: readonly string[];
  readonly url: string;
  readonly data: unknown;
};

export type ContributionPagesByLocale = Readonly<
  Record<Locale, readonly ContributionSourcePage[]>
>;

export type ContributionBoardItem = {
  readonly id: string;
  readonly kind: ContributionKind;
  readonly path: string;
  readonly section: ContentSection;
  readonly title: string;
  readonly href: string;
  readonly sourceLocale: Locale;
  readonly targetLocale?: Locale;
};

const excludedPaths = new Set(['about/contribution-board']);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function getContentStatus(data: unknown): 'complete' | 'incomplete' {
  return asRecord(data).contentStatus === 'incomplete' ? 'incomplete' : 'complete';
}

function getContentSection(slugs: readonly string[]): ContentSection | undefined {
  const section = slugs[0];
  return contentSections.includes(section as ContentSection) ? (section as ContentSection) : undefined;
}

function isLandingPage(page: ContributionSourcePage): boolean {
  const data = asRecord(page.data);
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  return page.slugs.length <= 1 || page.slugs.at(-1) === 'index' || tags.includes('index');
}

function isEligiblePage(page: ContributionSourcePage): boolean {
  const path = page.slugs.join('/');
  return Boolean(getContentSection(page.slugs)) && !excludedPaths.has(path) && !isLandingPage(page);
}

function toPageMap(pages: readonly ContributionSourcePage[]): Map<string, ContributionSourcePage> {
  return new Map(
    pages
      .filter(isEligiblePage)
      .map((page) => [page.slugs.join('/'), page] as const),
  );
}

function createItem(
  kind: ContributionKind,
  page: ContributionSourcePage,
  section: ContentSection,
  path: string,
  targetLocale?: Locale,
): ContributionBoardItem {
  const fallbackTitle = path.split('/').at(-1) ?? path;
  const data = asRecord(page.data);

  return {
    id: targetLocale ? `${kind}:${path}:${targetLocale}` : `${kind}:${path}`,
    kind,
    path,
    section,
    title: getString(data.title, fallbackTitle),
    href: page.url,
    sourceLocale: page.locale,
    ...(targetLocale ? { targetLocale } : {}),
  };
}

export function deriveContributionBoardItems(
  pages: ContributionPagesByLocale,
  locale: Locale,
): ContributionBoardItem[] {
  const localizedPages = Object.fromEntries(
    locales.map((pageLocale) => [pageLocale, toPageMap(pages[pageLocale])]),
  ) as Record<Locale, Map<string, ContributionSourcePage>>;
  const paths = [
    ...new Set(locales.flatMap((pageLocale) => [...localizedPages[pageLocale].keys()])),
  ].sort((a, b) => a.localeCompare(b));
  const items: ContributionBoardItem[] = [];

  for (const path of paths) {
    const pagesForPath = locales.flatMap((pageLocale) => {
      const page = localizedPages[pageLocale].get(path);
      return page ? [{ locale: pageLocale, page }] : [];
    });
    const section = getContentSection(pagesForPath[0]?.page.slugs ?? []);

    if (!section) continue;

    const localizedPage =
      localizedPages[locale].get(path) ??
      localizedPages[defaultLocale].get(path) ??
      pagesForPath[0]?.page;
    if (!localizedPage) continue;

    const incompletePage = pagesForPath.find(
      ({ page }) => getContentStatus(page.data) === 'incomplete',
    );
    if (incompletePage) {
      items.push(createItem('incomplete', incompletePage.page, section, path));
    }

    const sourcePage = localizedPages[defaultLocale].get(path) ?? pagesForPath[0]?.page;
    if (!sourcePage) continue;

    for (const targetLocale of locales) {
      if (localizedPages[targetLocale].has(path)) continue;

      items.push(createItem('translation', sourcePage, section, path, targetLocale));
    }
  }

  return items.sort((a, b) => {
    const kindOrder = a.kind.localeCompare(b.kind);
    return kindOrder || a.path.localeCompare(b.path) || a.id.localeCompare(b.id);
  });
}

/** 首頁保留所有待補全內容，但只顯示目前網站語系的待翻譯項目。 */
export function filterContributionItemsForLocale(
  items: readonly ContributionBoardItem[],
  locale: Locale,
): ContributionBoardItem[] {
  return items.filter(
    (item) => item.kind === 'incomplete' || item.targetLocale === locale,
  );
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function selectContributionHighlights(
  items: readonly ContributionBoardItem[],
  limit = 4,
  seed = 'home',
): ContributionBoardItem[] {
  const count = Math.max(0, Math.floor(limit));
  if (count === 0) return [];

  const ranked = [...items]
    .sort((left, right) => {
      const rank = stableHash(`${seed}:${left.id}`) - stableHash(`${seed}:${right.id}`);
      return rank || left.id.localeCompare(right.id);
    });
  const selected: ContributionBoardItem[] = [];
  const selectedPaths = new Set<string>();

  for (const item of ranked) {
    if (selectedPaths.has(item.path)) continue;

    selected.push(item);
    selectedPaths.add(item.path);
    if (selected.length >= count) break;
  }

  return selected;
}
