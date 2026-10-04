import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import blogMeta from '../../content/blog/meta.json';
import blogZhCnMeta from '../../content/blog/meta.zh-cn.json';
import aboutMeta from '../../content/about/meta.json';
import aboutEnMeta from '../../content/about/meta.en.json';
import guidesMeta from '../../content/guides/meta.json';
import guidesZhCnMeta from '../../content/guides/meta.zh-cn.json';
import aboutZhCnMeta from '../../content/about/meta.zh-cn.json';
import recommendationsZhCnMeta from '../../content/recommendations/meta.zh-cn.json';
import toolsMeta from '../../content/tools/meta.json';
import toolsEnMeta from '../../content/tools/meta.en.json';
import toolsZhCnMeta from '../../content/tools/meta.zh-cn.json';
import { baseOptions, docsOptions, getNavigationLinks } from './layout.shared';

const aboutIndexSource = readFileSync(
  new URL('../../content/about/index.mdx', import.meta.url),
  'utf8',
);
const privacyPageSource = readFileSync(
  new URL('../../content/about/privacy.mdx', import.meta.url),
  'utf8',
);

describe('Fumadocs navigation', () => {
  it('builds locale-aware navigation links', () => {
    expect(getNavigationLinks('zh-tw')).toMatchObject([
      { text: '工具', url: '/zh-tw/tools' },
      { text: '教學', url: '/zh-tw/guides' },
      { text: '文章', url: '/zh-tw/blog' },
      { text: '推薦', url: '/zh-tw/recommendations' },
      { text: '關於', url: '/zh-tw/about' },
    ]);

    expect(getNavigationLinks('en')).toMatchObject([
      { text: 'Tools', url: '/en/tools' },
      { text: 'Guides', url: '/en/guides' },
      { text: 'Blog', url: '/en/blog' },
      { text: 'Recommendations', url: '/en/recommendations' },
      { text: 'About', url: '/en/about' },
    ]);

    expect(getNavigationLinks('zh-tw')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '玩家設定' }),
        expect.objectContaining({ text: 'CCO Helper' }),
      ]),
    );
  });

  it('keeps the Fumadocs title link on the current locale home', () => {
    expect(baseOptions('en').nav).toMatchObject({
      title: 'CCO Toolkit',
      url: '/en',
    });
  });

  it('lets the docs root selector own section navigation', () => {
    expect(docsOptions('zh-tw').links).toEqual([]);
    expect(baseOptions('zh-tw').links).toHaveLength(5);
  });

  it('disables theme switches in both home and docs layouts', () => {
    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      expect(baseOptions(locale).themeSwitch?.enabled).toBe(false);
      expect(docsOptions(locale).themeSwitch?.enabled).toBe(false);
    }
    expect(baseOptions('en').slots?.themeSwitch).toBeUndefined();
    expect(docsOptions('zh-tw').slots?.themeSwitch).toBeUndefined();
  });

  it('provides a mobile-only mount point between the docs title and search trigger', () => {
    expect(docsOptions('zh-tw').nav?.children).toMatchObject({
      type: 'div',
      props: {
        'data-cco-tool-header-settings-slot': '',
        className: expect.stringContaining('max-md:flex'),
      },
    });
  });

  it('provides a tool-only player settings link around the official language slot', () => {
    const options = docsOptions('zh-tw');

    expect(options.slots?.languageSelect).toMatchObject({
      root: expect.any(Function),
      text: expect.any(Function),
    });
    expect(options.nav?.children).toMatchObject({
      props: {
        children: expect.anything(),
      },
    });
  });

  it('localizes the Tools, Guides, Blog and Tools sidebar separators', () => {
    expect([
      toolsMeta.title,
      guidesMeta.title,
      blogMeta.title,
    ]).toEqual(['工具', '教學', '文章']);
    expect(toolsMeta.pages.filter((page) => page.startsWith('---'))).toEqual([
      '---工具---',
      '---CCO Helper---',
    ]);
    expect(toolsEnMeta.pages.filter((page) => page.startsWith('---'))).toEqual([
      '---Tools---',
      '---CCO Helper---',
    ]);
  });

  it('uses each document overview as its section entry', () => {
    expect(toolsMeta.pagesIndex).toBe('index');
    expect(guidesMeta.pagesIndex).toBe('index');
  });

  it('keeps existing tool order and places Helper at the end as a direct page', () => {
    expect(toolsMeta.pages).toEqual([
      '---工具---',
      'backpack-planner',
      'black-market',
      'dungeon',
      'earnings-overview',
      'level-conversion',
      'loot-box-analysis',
      'mining',
      'search-reward',
      '---CCO Helper---',
      'helper-overview',
    ]);
  });

  it('keeps Guide sidebar order and beginner/advanced groups explicit', () => {
    expect(guidesMeta.pages).toEqual([
      '---入門---',
      'new-player',
      'gang',
      'cache-and-equipment',
      'resources',
      'trading',
      'faq',
      '---進階---',
      'advanced-features',
      'dungeon-loadout',
      'buffs-and-items',
      'formulas',
    ]);
  });

  it('uses simplified-Chinese navigation labels without requiring translated MDX pages', () => {
    expect(toolsZhCnMeta.pages).toEqual([
      '---工具---',
      'backpack-planner',
      'black-market',
      'dungeon',
      'earnings-overview',
      'level-conversion',
      'loot-box-analysis',
      'mining',
      'search-reward',
      '---CCO Helper---',
      'helper-overview',
    ]);
    expect(guidesZhCnMeta.pages).toEqual([
      '---入门---',
      'new-player',
      'gang',
      'cache-and-equipment',
      'resources',
      'trading',
      'faq',
      '---进阶---',
      'advanced-features',
      'dungeon-loadout',
      'buffs-and-items',
      'formulas',
    ]);
    expect(aboutZhCnMeta.pages).toEqual([
      'privacy',
      'licensing',
      'changelog',
      'contribution-board',
      'contributing',
    ]);
    expect(aboutMeta.pages).toEqual(aboutEnMeta.pages);
    expect(aboutIndexSource).toContain('[隱私說明](./privacy)');
    expect(privacyPageSource).toMatch(/^更新日期：\d{4}-\d{2}-\d{2}$/m);
    expect(privacyPageSource).toContain('localStorage');
    expect(privacyPageSource).toContain('目前網站程式碼沒有設定或讀取 Cookie');
    expect(getNavigationLinks('zh-tw')).toContainEqual(
      expect.objectContaining({ text: '關於', url: '/zh-tw/about' }),
    );
    expect(getNavigationLinks('zh-tw')).not.toContainEqual(
      expect.objectContaining({ url: '/zh-tw/about/privacy' }),
    );
    expect(toolsZhCnMeta.pageTitles).toMatchObject({
      'backpack-planner': '背包升级规划',
      dungeon: '地下城评估',
      'earnings-overview': '活动收益总览',
      'level-conversion': '等级换算',
      'loot-box-analysis': '箱子／掉落价值分析',
      mining: '挖矿等级与收益',
      'search-reward': '搜索收益计算器',
      'helper-overview': 'CCO Helper 简介',
    });
    expect(guidesZhCnMeta.pageTitles).toMatchObject({
      'cache-and-equipment': '图纸与装备',
      'dungeon-loadout': '地下城配装',
      'buffs-and-items': 'Buff 与物品总览',
    });
    expect(aboutZhCnMeta.pageTitles).toMatchObject({
      privacy: '隐私说明',
      'contribution-board': '贡献看板',
      contributing: '贡献指南',
    });
    expect(blogZhCnMeta).toMatchObject({ title: '文章', pageTitles: { index: '文章总览' } });
    expect(recommendationsZhCnMeta).toMatchObject({ title: '推荐', pageTitles: { index: '推荐' } });
    expect(JSON.stringify([
      toolsZhCnMeta,
      guidesZhCnMeta,
      aboutZhCnMeta,
      blogZhCnMeta,
      recommendationsZhCnMeta,
    ])).not.toMatch(/[體學覽計與裝評總礦規貢薦]/);
  });
});
