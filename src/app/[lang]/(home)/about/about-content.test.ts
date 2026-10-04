import { readFileSync } from 'node:fs';
import { createElement, type ElementType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MDXComponents } from 'mdx/types';

vi.mock('@/lib/source', () => ({
  source: {
    getPage: vi.fn(),
    getPages: vi.fn(),
  },
  getPageImageUrl: vi.fn(() => ({ segments: [], url: '/test-image.png' })),
}));

vi.mock('@/lib/contribution-board-source', () => ({
  getContributionBoard: vi.fn(() => []),
}));

import { source } from '@/lib/source';

import {
  generateMetadata as generateAboutChildMetadata,
  generateStaticParams as generateAboutChildStaticParams,
  default as AboutChildPage,
} from './[...slug]/page';

function readProjectFile(path: string): string {
  return readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function renderChangelogFromMDX({ components }: { components?: MDXComponents }) {
  const ChangelogComponent = components?.Changelog;

  return ChangelogComponent
    ? createElement(ChangelogComponent as ElementType)
    : null;
}

const aboutPageFixtures = [
  {
    locale: 'zh-tw',
    slugs: ['about', 'licensing'],
    url: '/zh-tw/about/licensing',
    data: { title: '授權與聲明', description: '授權範圍與聲明。', body: () => null },
  },
  {
    locale: 'zh-tw',
    slugs: ['about', 'changelog'],
    url: '/zh-tw/about/changelog',
    data: {
      title: '更新紀錄',
      description: '完整更新紀錄。',
      body: renderChangelogFromMDX,
    },
  },
];

describe('About pages and routes', () => {
  beforeEach(() => {
    vi.mocked(source.getPages).mockImplementation((locale) =>
      aboutPageFixtures.filter((page) => page.locale === locale) as never,
    );
    vi.mocked(source.getPage).mockImplementation((slugs, locale) =>
      (aboutPageFixtures.find(
      (page) => page.locale === locale && page.slugs.join('/') === slugs?.join('/'),
      ) as never) ?? undefined,
    );
  });

  it('首頁精簡呈現簡介、單句非官方聲明、貢獻入口及最近三筆更新', () => {
    const about = normalizeLineEndings(readProjectFile('content/about/index.mdx'));

    expect(about).toContain('**CCO Toolkit** 是為 **CyberCode Online** 整理的工具與知識入口。');
    const nonOfficialStatement =
      '本網站為獨立的非官方社群工具，與 CyberCode Online 開發者沒有隸屬、合作或背書關係，也不代表官方立場。';
    expect(about).toContain(`\n\n${nonOfficialStatement}\n\n`);
    expect(about.match(/本網站為獨立的非官方社群工具/g)).toHaveLength(1);
    const extendedInfoIndex = about.indexOf('## 延伸資訊');
    const licensingLink = '[授權與聲明](./licensing)';
    expect(extendedInfoIndex).toBeGreaterThan(-1);
    expect(about.slice(0, extendedInfoIndex)).not.toContain(licensingLink);
    expect(about.slice(extendedInfoIndex)).toContain(licensingLink);
    expect(about.match(/\[授權與聲明\]\(\.\/licensing\)/g)).toHaveLength(1);
    expect(about).toContain('[貢獻指南](./contributing)');
    expect(about).toContain('[貢獻看板](./contribution-board)');
    expect(about).toContain('<Contributors />');
    expect(about).toContain('<Changelog limit={3} />');
    expect(about).toContain('[查看完整更新紀錄](./changelog)');
    expect(about).toContain('[隱私說明](./privacy)');
    expect(about).not.toMatch(/Fumadocs|Next\.js|MDX|網站架構/);
  });

  it('授權頁保留首頁原聲明及完整 MIT、CC BY-SA 範圍和第三方排除文字', () => {
    const licensing = readProjectFile('content/about/licensing.mdx');
    const mitLicense = normalizeLineEndings(readProjectFile('LICENSE'));
    const contentLicense = normalizeLineEndings(readProjectFile('LICENSE-CONTENT.md')).replace(
      /^# 原創教學與文章文字授權\n\n/,
      '### 原創教學與文章文字授權\n\n',
    );

    expect(licensing).toContain(
      'CCO Toolkit 是獨立的非官方社群工具，與 **CyberCode Online** 的開發者沒有隸屬、合作或背書關係，也不代表官方立場。',
    );
    expect(licensing).toContain(
      '依官方使用條款，CyberCode Online 應用程式及其相關商標、著作權、資料庫等智慧財產權由 **Dexter Huang** 持有。',
    );
    expect(licensing).toContain(
      '教學截圖可能包含 CyberCode Online 的遊戲介面；Discord 名稱與標誌僅用於識別外部社群連結，不表示 Discord 對本站提供贊助或背書。',
    );
    expect(licensing).toContain(
      '本站原創程式碼依 [MIT 授權](https://opensource.org/license/mit) 授權；完整文字位於程式碼儲存庫根目錄 `LICENSE`，僅適用原創程式碼。本站有權授權的原創教學與文章文字依 [CC BY-SA 4.0 官方法律條文](https://creativecommons.org/licenses/by-sa/4.0/legalcode) 授權，適用範圍見根目錄 `LICENSE-CONTENT.md`。',
    );
    expect(licensing).toContain(
      'CyberCode Online 遊戲資料及相關底層權利、商標與截圖、Discord 標誌、第三方素材及引用內容不在上述授權範圍內；程式碼含有第三方資料也不代表該資料取得授權。',
    );
    expect(licensing).toContain(
      '社群稿件須先取得作者明確同意，才會依 CC BY-SA 4.0 發布；詳見[貢獻指南](./contributing.mdx)。',
    );
    expect(normalizeLineEndings(licensing)).toContain(mitLicense);
    expect(normalizeLineEndings(licensing)).toContain(contentLicense);
  });

  it('新增 About 頁面對各語系都有靜態路徑，未翻譯語系 metadata 指回繁中原頁', async () => {
    const staticParams = generateAboutChildStaticParams();

    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      for (const slug of ['licensing', 'changelog']) {
        expect(staticParams).toContainEqual({ lang: locale, slug: [slug] });
      }
    }

    for (const metadataFile of ['meta.json', 'meta.zh-cn.json', 'meta.en.json']) {
      const metadata = JSON.parse(readProjectFile(`content/about/${metadataFile}`)) as {
        pages: string[];
      };
      expect(metadata.pages).toEqual(expect.arrayContaining(['licensing', 'changelog']));
    }

    const sourceMetadata = await generateAboutChildMetadata({
      params: Promise.resolve({ lang: 'zh-tw', slug: ['licensing'] }),
    });
    expect(sourceMetadata.title).toBe('授權與聲明');
    expect(sourceMetadata.alternates?.canonical).toMatch(/\/zh-tw\/about\/licensing\/?$/);

    const fallbackMetadata = await generateAboutChildMetadata({
      params: Promise.resolve({ lang: 'en', slug: ['licensing'] }),
    });
    expect(fallbackMetadata.robots).toEqual({ index: false, follow: true });
    expect(fallbackMetadata.alternates?.canonical).toMatch(/\/zh-tw\/about\/licensing\/?$/);
    expect(fallbackMetadata.alternates?.languages).toEqual({
      'zh-TW': fallbackMetadata.alternates?.canonical,
    });
  });

  it('完整更新紀錄頁將既有 Changelog 元件注入 MDX 並輸出全部來源紀錄', async () => {
    const page = await AboutChildPage({
      params: Promise.resolve({ lang: 'zh-tw', slug: ['changelog'] }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('網站開始建立');
    expect(markup).toContain('<time');
  });
});
