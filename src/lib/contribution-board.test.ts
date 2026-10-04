import { describe, expect, it } from 'vitest';
import {
  deriveContributionBoardItems,
  filterContributionItemsForLocale,
  selectContributionHighlights,
  type ContributionPagesByLocale,
  type ContributionSourcePage,
} from './contribution-board';

function page(
  locale: ContributionSourcePage['locale'],
  path: string,
  data: Record<string, unknown> = {},
): ContributionSourcePage {
  return {
    locale,
    slugs: path.split('/'),
    url: `/${locale}/${path}`,
    data: {
      title: `${locale}:${path}`,
      description: `Description for ${path}`,
      ...data,
    },
  };
}

function samplePages(): ContributionPagesByLocale {
  return {
    'zh-tw': [
      page('zh-tw', 'tools', { tags: ['index'], contentStatus: 'incomplete' }),
      page('zh-tw', 'tools/helper-overview', { contentStatus: 'incomplete' }),
      page('zh-tw', 'guides/advanced-features', { contentStatus: 'incomplete' }),
      page('zh-tw', 'guides/complete-guide'),
      page('zh-tw', 'blog/zh-only'),
      page('zh-tw', 'blog/shared'),
      page('zh-tw', 'about/contribution-board'),
    ],
    'zh-cn': [
      page('zh-cn', 'guides/complete-guide'),
    ],
    en: [
      page('en', 'tools/helper-overview'),
      page('en', 'guides/complete-guide'),
      page('en', 'guides/en-only'),
      page('en', 'blog/shared'),
    ],
  };
}

describe('contribution board derivation', () => {
  it('derives incomplete content and missing translations from localized pages', () => {
    const items = deriveContributionBoardItems(samplePages(), 'zh-tw');

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'incomplete:guides/advanced-features',
          kind: 'incomplete',
          sourceLocale: 'zh-tw',
        }),
        expect.objectContaining({
          id: 'translation:guides/advanced-features:en',
          kind: 'translation',
          targetLocale: 'en',
        }),
        expect.objectContaining({
          id: 'translation:blog/zh-only:en',
          targetLocale: 'en',
        }),
        expect.objectContaining({
          id: 'translation:guides/en-only:zh-tw',
          sourceLocale: 'en',
          targetLocale: 'zh-tw',
        }),
        expect.objectContaining({
          id: 'translation:guides/advanced-features:zh-cn',
          kind: 'translation',
          targetLocale: 'zh-cn',
        }),
      ]),
    );
    expect(items.every((item) => !('description' in item))).toBe(true);
  });

  it('treats missing contentStatus as complete', () => {
    const items = deriveContributionBoardItems(
      {
        'zh-tw': [page('zh-tw', 'guides/complete')],
        'zh-cn': [],
        en: [],
      },
      'zh-tw',
    );

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'translation:guides/complete:en', kind: 'translation' }),
      expect.objectContaining({ id: 'translation:guides/complete:zh-cn', kind: 'translation' }),
    ]));
    expect(items).toHaveLength(2);
    expect(items.some((item) => item.kind === 'incomplete')).toBe(false);
  });

  it('excludes section landings, nested landing pages, and the board itself', () => {
    const items = deriveContributionBoardItems(samplePages(), 'en');
    const paths = items.map((item) => item.path);

    expect(paths).not.toContain('tools');
    expect(paths).not.toContain('about/contribution-board');
    expect(paths).toContain('tools/helper-overview');
  });

  it('只依目標語系篩選待翻譯項目，待補全項目不受影響', () => {
    const items = deriveContributionBoardItems(samplePages(), 'zh-tw');
    const filtered = filterContributionItemsForLocale(items, 'en');

    expect(filtered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'incomplete' }),
        expect.objectContaining({ kind: 'translation', targetLocale: 'en' }),
      ]),
    );
    expect(filtered).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'translation', targetLocale: 'zh-tw' })]),
    );

    const simplifiedFiltered = filterContributionItemsForLocale(items, 'zh-cn');
    expect(simplifiedFiltered).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'translation', targetLocale: 'zh-cn' })]),
    );
    expect(simplifiedFiltered).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'translation', targetLocale: 'en' })]),
    );
  });
});

describe('contribution board highlights', () => {
  const items = deriveContributionBoardItems(samplePages(), 'zh-tw');

  it('returns a bounded sample without mutating source order', () => {
    const originalIds = items.map((item) => item.id);
    const first = selectContributionHighlights(items, 4, 'home');
    const second = selectContributionHighlights(items, 4, 'home');

    expect(first).toHaveLength(4);
    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(items.map((item) => item.id)).toEqual(originalIds);
  });

  it('handles empty and zero-size samples deterministically', () => {
    expect(selectContributionHighlights([], 4, 'home')).toEqual([]);
    expect(selectContributionHighlights(items, 0, 'home')).toEqual([]);
  });

  it('does not repeat a page that needs both completion and translation', () => {
    const highlights = selectContributionHighlights(items, 10, 'home');
    const paths = highlights.map((item) => item.path);

    expect(paths).toHaveLength(new Set(paths).size);
  });
});
