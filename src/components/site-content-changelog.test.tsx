import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getChangelogEntries, type ChangelogEntry } from '@/lib/site-content';
import type { Locale } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';

import { Changelog } from './site-content';

vi.mock('@/lib/site-content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/site-content')>();

  return {
    ...actual,
    getChangelogEntries: vi.fn(),
  };
});

const fixtureEntries: ChangelogEntry[] = [
  { date: '2026-10-04', title: '10 月 4 日', description: '第一筆。' },
  { date: '2026-10-02', title: '10 月 2 日', description: '第二筆。' },
  { date: '2026-09-30', title: '9 月 30 日', description: '第三筆。' },
  { date: '2026-09-20', title: '9 月 20 日', description: '第四筆。' },
];

const translatedFixtureContent = {
  en: [
    { title: 'Website launch', description: 'First entry in English.' },
    { title: 'Second update', description: 'Second entry in English.' },
    { title: 'Third update', description: 'Third entry in English.' },
    { title: 'Fourth update', description: 'Fourth entry in English.' },
  ],
  'zh-cn': [
    { title: '网站上线', description: '第一条简体中文记录。' },
    { title: '第二次更新', description: '第二条简体中文记录。' },
    { title: '第三次更新', description: '第三条简体中文记录。' },
    { title: '第四次更新', description: '第四条简体中文记录。' },
  ],
} satisfies Record<Exclude<Locale, 'zh-tw'>, Pick<ChangelogEntry, 'title' | 'description'>[]>;

const mockedGetChangelogEntries = vi.mocked(getChangelogEntries);

function getRenderedEntries(markup: string) {
  return [...markup.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(([, entryMarkup]) => ({
    date: entryMarkup.match(/<time\b[^>]*datetime="([^"]+)"/i)?.[1],
    title: entryMarkup.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1],
    description: entryMarkup.match(/<p\b[^>]*>([\s\S]*?)<\/p>/)?.[1],
  }));
}

describe('Changelog component', () => {
  beforeEach(() => {
    mockedGetChangelogEntries.mockImplementation((locale: Locale = 'zh-tw') =>
      fixtureEntries.map((entry, index) => ({
        ...entry,
        ...(locale === 'zh-tw' ? undefined : translatedFixtureContent[locale][index]),
      })),
    );
  });

  it('limit 只呈現最新三筆，跨月維持單一時間軸與日期順序', () => {
    const markup = renderToStaticMarkup(<Changelog locale="zh-tw" limit={3} />);

    expect(getRenderedEntries(markup)).toEqual(fixtureEntries.slice(0, 3));
    expect(markup.match(/<ol\b/g) ?? []).toHaveLength(1);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(3);
    expect(markup).not.toMatch(/<section\b/);
    expect(markup).not.toContain('2026年10月');
    expect(markup).not.toContain('2026年9月');
  });

  it('未指定 limit 時將完整歷史依日期放在單一時間軸', () => {
    const markup = renderToStaticMarkup(<Changelog locale="zh-tw" />);

    expect(getRenderedEntries(markup)).toEqual(fixtureEntries);
    expect(markup.match(/<ol\b/g) ?? []).toHaveLength(1);
    expect(markup.match(/<h3\b/g) ?? []).toHaveLength(fixtureEntries.length);
    expect(markup).not.toMatch(/<section\b/);
    expect(markup).not.toContain('2026年10月');
    expect(markup).not.toContain('2026年9月');
  });

  it('按 locale 呈現已翻譯文案，並讓 limit 保留最新紀錄順序', () => {
    const englishMarkup = renderToStaticMarkup(<Changelog locale="en" limit={2} />);
    const simplifiedChineseMarkup = renderToStaticMarkup(
      <Changelog locale="zh-cn" limit={2} />,
    );

    expect(getRenderedEntries(englishMarkup)).toEqual([
      {
        date: '2026-10-04',
        title: 'Website launch',
        description: 'First entry in English.',
      },
      {
        date: '2026-10-02',
        title: 'Second update',
        description: 'Second entry in English.',
      },
    ]);
    expect(getRenderedEntries(simplifiedChineseMarkup)).toEqual([
      {
        date: '2026-10-04',
        title: '网站上线',
        description: '第一条简体中文记录。',
      },
      {
        date: '2026-10-02',
        title: '第二次更新',
        description: '第二条简体中文记录。',
      },
    ]);
    expect(mockedGetChangelogEntries).toHaveBeenLastCalledWith('zh-cn');
  });

  it('limit 為 0 時顯示空紀錄提示且不產生時間軸', () => {
    const markup = renderToStaticMarkup(<Changelog locale="zh-tw" limit={0} />);

    expect(markup).toContain(getMessages('zh-tw').aboutPage.changelogEmpty);
    expect(markup).not.toMatch(/<(?:ol|li|time)\b/);
  });
});
