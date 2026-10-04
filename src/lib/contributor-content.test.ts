import { describe, expect, it } from 'vitest';

import {
  resolveContributorContentPath,
  resolveContributorRecordViews,
} from './contributor-content';

const pages = [
  {
    path: 'tools/search-reward',
    locale: 'zh-tw' as const,
    href: '/zh-tw/tools/search-reward',
    title: '搜索收益計算器',
  },
  {
    path: 'guides/new-player',
    locale: 'en' as const,
    href: '/en/guides/new-player',
    title: 'New player guide',
  },
  {
    path: 'guides/new-player',
    locale: 'zh-tw' as const,
    href: '/zh-tw/guides/new-player',
    title: '新手指南',
  },
];

describe('contributor content resolver', () => {
  it('優先使用目前語系的實際頁面', () => {
    expect(resolveContributorContentPath('en', 'guides/new-player', pages)).toEqual({
      contentPath: 'guides/new-player',
      locale: 'en',
      href: '/en/guides/new-player',
      title: 'New player guide',
    });
  });

  it('目前語系缺頁時 fallback 到實際存在的其他語系 URL', () => {
    expect(resolveContributorContentPath('en', 'tools/search-reward', pages)).toEqual({
      contentPath: 'tools/search-reward',
      locale: 'zh-tw',
      href: '/zh-tw/tools/search-reward',
      title: '搜索收益計算器',
    });
  });

  it('紀錄指定語系時只連到該語系實際存在的頁面', () => {
    expect(resolveContributorRecordViews('en', [
      {
        id: 'zh-tw-guide-record',
        contributorId: 'alice',
        category: 'translation',
        acceptedAt: '2026-09-05',
        contentPath: 'guides/new-player',
        locale: 'zh-tw',
      },
      {
        id: 'missing-zh-cn-record',
        contributorId: 'alice',
        category: 'translation',
        acceptedAt: '2026-09-06',
        contentPath: 'guides/new-player',
        locale: 'zh-cn',
      },
    ], pages)).toEqual([
      {
        record: expect.objectContaining({ id: 'zh-tw-guide-record' }),
        target: {
          contentPath: 'guides/new-player',
          locale: 'zh-tw',
          href: '/zh-tw/guides/new-player',
          title: '新手指南',
        },
      },
      {
        record: expect.objectContaining({ id: 'missing-zh-cn-record' }),
      },
    ]);
  });

  it('未知目標或不合法路徑不產生連結', () => {
    expect(resolveContributorContentPath('en', 'tools/missing', pages)).toBeUndefined();
    expect(resolveContributorContentPath('en', '/tools/search-reward', pages)).toBeUndefined();
  });

  it('建立紀錄 views 時保留無目標紀錄，並只對實際頁面套用 locale fallback', () => {
    expect(resolveContributorRecordViews('en', [
      {
        id: 'translated-record',
        contributorId: 'alice',
        category: 'translation',
        acceptedAt: '2026-09-05',
        contentPath: 'tools/search-reward',
      },
      {
        id: 'unlinked-record',
        contributorId: 'alice',
        category: 'tool-debugging',
        acceptedAt: '2026-09-03',
      },
      {
        id: 'missing-record',
        contributorId: 'alice',
        category: 'article-edit',
        acceptedAt: '2026-09-01',
        contentPath: 'tools/missing',
      },
      {
        id: 'reverted-record',
        contributorId: 'alice',
        category: 'article-edit',
        acceptedAt: '2026-09-06',
        contentPath: 'guides/new-player',
        status: 'reverted',
      },
    ], pages)).toEqual([
      {
        record: expect.objectContaining({ id: 'translated-record' }),
        target: {
          contentPath: 'tools/search-reward',
          locale: 'zh-tw',
          href: '/zh-tw/tools/search-reward',
          title: '搜索收益計算器',
        },
      },
      {
        record: expect.objectContaining({ id: 'unlinked-record' }),
      },
      {
        record: expect.objectContaining({ id: 'missing-record' }),
      },
    ]);
  });
});
