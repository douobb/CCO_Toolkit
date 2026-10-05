import { readFile } from 'node:fs/promises';
import { parse, type AtRule, type Rule } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import HomePage from './page';
import { siteHomeTitleClassName } from '@/components/site-page-title';
import { getMessages } from '@/lib/translations';

const siteEffectsStylesPath = new URL('../../../app/site-effects.css', import.meta.url);
const homePageContentStylesPath = new URL('../../../components/home-page-content.module.css', import.meta.url);

vi.mock('@/lib/contribution-board-source', () => ({
  getContributionBoard: () => [
    {
      id: 'incomplete:guides/incomplete',
      kind: 'incomplete',
      path: 'guides/incomplete',
      section: 'guides',
      title: 'Incomplete contribution',
      href: '/zh-tw/guides/incomplete',
      sourceLocale: 'zh-tw',
    },
    {
      id: 'translation:guides/chinese-target:zh-tw',
      kind: 'translation',
      path: 'guides/chinese-target',
      section: 'guides',
      title: 'Chinese target contribution',
      href: '/zh-tw/guides/chinese-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'zh-tw',
    },
    {
      id: 'translation:guides/english-target:en',
      kind: 'translation',
      path: 'guides/english-target',
      section: 'guides',
      title: 'English target contribution',
      href: '/zh-tw/guides/english-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'en',
    },
    {
      id: 'incomplete:tools/tool-incomplete',
      kind: 'incomplete',
      path: 'tools/tool-incomplete',
      section: 'tools',
      title: 'Incomplete tool contribution',
      href: '/zh-tw/tools/tool-incomplete',
      sourceLocale: 'zh-tw',
    },
    {
      id: 'incomplete:blog/article-incomplete',
      kind: 'incomplete',
      path: 'blog/article-incomplete',
      section: 'blog',
      title: 'Incomplete article contribution',
      href: '/zh-tw/blog/article-incomplete',
      sourceLocale: 'zh-tw',
    },
    {
      id: 'translation:guides/simplified-target:zh-cn',
      kind: 'translation',
      path: 'guides/simplified-target',
      section: 'guides',
      title: 'Simplified Chinese target contribution',
      href: '/zh-tw/guides/simplified-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'zh-cn',
    },
    {
      id: 'translation:tools/tool-target:zh-tw',
      kind: 'translation',
      path: 'tools/tool-target',
      section: 'tools',
      title: 'Tool translation target',
      href: '/zh-tw/tools/tool-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'zh-tw',
    },
    {
      id: 'translation:tools/tool-target:en',
      kind: 'translation',
      path: 'tools/tool-target',
      section: 'tools',
      title: 'Tool translation target',
      href: '/zh-tw/tools/tool-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'en',
    },
    {
      id: 'translation:tools/tool-target:zh-cn',
      kind: 'translation',
      path: 'tools/tool-target',
      section: 'tools',
      title: 'Tool translation target',
      href: '/zh-tw/tools/tool-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'zh-cn',
    },
    {
      id: 'translation:blog/article-target:zh-tw',
      kind: 'translation',
      path: 'blog/article-target',
      section: 'blog',
      title: 'Article translation target',
      href: '/zh-tw/blog/article-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'zh-tw',
    },
    {
      id: 'translation:blog/article-target:en',
      kind: 'translation',
      path: 'blog/article-target',
      section: 'blog',
      title: 'Article translation target',
      href: '/zh-tw/blog/article-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'en',
    },
    {
      id: 'translation:blog/article-target:zh-cn',
      kind: 'translation',
      path: 'blog/article-target',
      section: 'blog',
      title: 'Article translation target',
      href: '/zh-tw/blog/article-target',
      sourceLocale: 'zh-tw',
      targetLocale: 'zh-cn',
    },
  ],
}));

describe('home page information architecture', () => {
  it('makes the tools, guides, and settings cards single keyboard-focusable links', async () => {
    const element = await HomePage({ params: Promise.resolve({ lang: 'zh-tw' }) });
    const markup = renderToStaticMarkup(element);

    const primaryCards = [
      ['/zh-tw/tools', '計算收益，規劃升級。'],
      ['/zh-tw/guides', '遊戲入門與進階教學。'],
      ['/zh-tw/settings', '集中管理玩家資料。'],
    ] as const;

    for (const [href, description] of primaryCards) {
      const anchor = markup.match(new RegExp(`<a(?=[^>]*href="${href}")[^>]*>[\\s\\S]*?<\\/a>`))?.[0];

      expect(anchor).toBeDefined();
      expect(anchor?.match(/<a\b/g)).toHaveLength(1);
      expect(anchor).toContain(description);
      expect(anchor).toContain('focus-visible:ring-2');
      expect(anchor).not.toMatch(/<svg[^>]*size-4/);
      if (href === '/zh-tw/settings') {
        expect(anchor).not.toMatch(/mt-3 size-4/);
      } else {
        expect(anchor).not.toContain('mt-5');
      }
    }
    for (const href of ['/zh-tw/tools', '/zh-tw/guides']) {
      const card = markup.match(new RegExp(`<a(?=[^>]*href="${href}")[^>]*>[\\s\\S]*?<\\/a>`))?.[0];
      const headingClasses = card?.match(/<h2\b[^>]*class="([^"]+)"/)?.[1]?.split(' ') ?? [];

      expect(headingClasses).toContain('site-home-section-heading');
      expect(headingClasses).toContain('font-semibold');
    }
    expect(markup).not.toContain('查看所有工具');
    expect(markup).not.toContain('瀏覽教學');
    expect(markup).not.toContain('開啟玩家設定');
    expect(markup).not.toContain('href="/zh-tw/guides/new-player"');
    expect(markup).not.toContain('href="/zh-tw/tools/helper-overview"');
    expect(markup).not.toContain('CCO Helper');
    expect(markup).not.toContain('核心入口');
    expect(markup).not.toContain('home-primary-heading');
    expect(markup.match(/site-home-section-heading/g)).toHaveLength(4);
    expect(markup.match(/<h2 id="home-contribution-heading" class="([^"]+)"/)?.[1])
      .toContain('site-home-section-heading');
    expect(markup.match(/<h2 id="home-secondary-heading" class="([^"]+)"/)?.[1])
      .toContain('site-home-section-heading');
    expect(markup).toContain('href="/zh-tw/settings"');
    expect(markup).toContain('href="/zh-tw/about/contribution-board"');
    expect(markup).toContain('href="/zh-tw/about/contributing"');
    const contributionActions = [
      ['/zh-tw/about/contribution-board', 'bg-fd-primary'],
      ['/zh-tw/about/contributing', 'bg-fd-card'],
    ] as const;
    for (const [href, variantClass] of contributionActions) {
      const contributionAction = markup.match(
        new RegExp(`<a(?=[^>]*href="${href}")[^>]*>[\\s\\S]*?<\\/a>`),
      )?.[0];

      expect(contributionAction).toBeDefined();
      expect(contributionAction).not.toMatch(/<svg/);
      expect(contributionAction).toContain('min-h-11');
      expect(contributionAction).toContain('px-3');
      expect(contributionAction).toContain('py-2');
      expect(contributionAction).toContain('text-base');
      expect(contributionAction).toContain('focus-visible:ring-2');
      expect(contributionAction).toContain(variantClass);
    }
    expect(markup).toContain('href="/zh-tw/blog"');
    expect(markup).toContain('href="/zh-tw/recommendations"');
    expect(markup).toContain('href="/zh-tw/about"');
    expect(markup).not.toContain('data-contribution-highlights');
    expect(markup).toContain('href="/zh-tw/about/contribution-board"');
  });

  it.each(['zh-tw', 'zh-cn', 'en'] as const)(
    'omits the secondary eyebrow and keeps the section heading in %s',
    async (locale) => {
      const element = await HomePage({ params: Promise.resolve({ lang: locale }) });
      const markup = renderToStaticMarkup(element);
      const secondary = getMessages(locale).home.secondary;

      expect(markup).not.toContain(secondary.eyebrow);
      expect(markup).toContain(secondary.title);
      expect(markup).toContain(secondary.blogTitle);
      expect(markup).toMatch(/<h2 id="home-secondary-heading" class="[^"]*site-home-section-heading/);
    },
  );

  it.each(['zh-tw', 'zh-cn', 'en'] as const)(
    'counts incomplete content and only current-locale translations in %s',
    async (locale) => {
      const element = await HomePage({ params: Promise.resolve({ lang: locale }) });
      const markup = renderToStaticMarkup(element);
      const contribution = getMessages(locale).home.contribution;
      const counts = markup.match(/<dl data-contribution-counts[^>]*>[\s\S]*?<\/dl>/)?.[0];
      const countFor = (kind: 'incomplete' | 'translation') => counts?.match(
        new RegExp(`<div data-contribution-count="${kind}"[\\s\\S]*?<dd[^>]*>(\\d+)<\\/dd>`),
      )?.[1];

      expect(markup).toContain(contribution.boardLink);
      expect(markup).toContain(contribution.guideLink);
      expect(counts).toContain(contribution.counts.incomplete);
      expect(counts).toContain(contribution.counts.translation);
      expect(countFor('incomplete')).toBe('3');
      expect(countFor('translation')).toBe('3');
    },
  );

  it('keeps the settings and contribution cards compact and visually consistent', async () => {
    const element = await HomePage({ params: Promise.resolve({ lang: 'zh-tw' }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('class="mt-8 grid gap-3 sm:mt-10 md:grid-cols-2"');
    const toolsCard = markup.match(/<a(?=[^>]*href="\/zh-tw\/tools")[^>]*>/)?.[0];
    const guideCard = markup.match(/<a(?=[^>]*href="\/zh-tw\/guides")[^>]*>/)?.[0];
    const settingsCard = markup.match(
      /<a(?=[^>]*href="\/zh-tw\/settings")[^>]*>[\s\S]*?<\/a>/,
    )?.[0];
    const contributionCard = markup.match(/<section(?=[^>]*data-contribution-card="true")[^>]*>/)?.[0];
    for (const primaryCard of [toolsCard, guideCard, contributionCard]) {
      expect(primaryCard).toContain('p-6');
      expect(primaryCard).toContain('sm:p-8');
      expect(primaryCard?.match(/class="([^"]+)"/)?.[1].split(' ')).not.toContain('p-5');
    }
    const sharedCardStyles = ['rounded-2xl', 'border', 'border-fd-border', 'bg-fd-card'];
    for (const summaryCard of [settingsCard, contributionCard]) {
      const classes = summaryCard?.match(/class="([^"]+)"/)?.[1].split(' ') ?? [];

      expect(classes.filter((className) => sharedCardStyles.includes(className))).toEqual(sharedCardStyles);
    }
    expect(settingsCard).toContain('size-5');
    expect(settingsCard).toContain('aria-hidden="true"');
    expect(settingsCard).not.toContain('site-home-section-heading');
    expect(markup).toMatch(/<div(?=[^>]*data-home-summary-cards="true")[^>]*>[\s\S]*?href="\/zh-tw\/settings"[\s\S]*?<section(?=[^>]*data-contribution-card="true")/);

    const contributionMarkup = markup.match(
      /<section(?=[^>]*data-contribution-card="true")[^>]*>[\s\S]*?<\/section>/,
    )?.[0];
    const headingClasses = [settingsCard, contributionMarkup].map((card) =>
      card?.match(/<h2[^>]*class="([^"]+)"/)?.[1]
        ?.split(' ')
        .filter((className) => !['group-hover:underline', 'site-home-section-heading'].includes(className)),
    );
    expect(headingClasses[0]).toEqual(expect.arrayContaining([
      'text-base',
      'font-semibold',
      'text-fd-foreground',
    ]));
    expect(headingClasses[0]).not.toContain('text-2xl');
    expect(settingsCard).toContain('mt-1 text-sm leading-6');
    expect(headingClasses[1]).toEqual(expect.arrayContaining([
      'text-2xl',
      'font-semibold',
      'tracking-tight',
      'text-fd-foreground',
    ]));

    for (const href of ['/zh-tw/blog', '/zh-tw/recommendations', '/zh-tw/about']) {
      const secondaryCard = markup.match(
        new RegExp(`<a(?=[^>]*href="${href}")[^>]*>[\\s\\S]*?<\\/a>`),
      )?.[0];
      const headingClasses = secondaryCard?.match(/<h3\b[^>]*class="([^"]+)"/)?.[1]?.split(' ') ?? [];

      expect(secondaryCard).toContain('p-5');
      expect(secondaryCard).not.toContain('sm:p-8');
      expect(headingClasses).toContain('font-semibold');
      expect(headingClasses).not.toContain('site-home-section-heading');
    }
    expect(markup).toContain('<section aria-labelledby="home-secondary-heading" class="mt-8 sm:mt-12">');
    expect(markup).toContain('class="mt-6 grid gap-3 sm:grid-cols-3"');
    expect(markup).toContain('site-home-section-heading text-2xl font-semibold');
  });

  it('keeps the cards stacked and uses contribution width for compact stats and actions', async () => {
    const element = await HomePage({ params: Promise.resolve({ lang: 'en' }) });
    const markup = renderToStaticMarkup(element);
    const counts = markup.match(/<dl data-contribution-counts[^>]*>[\s\S]*?<\/dl>/)?.[0];
    const statPairs = Array.from(
      counts?.matchAll(/<div data-contribution-count="(?:incomplete|translation)"[^>]*>[\s\S]*?<\/div>/g) ?? [],
      ([pair]) => pair,
    );

    expect(statPairs).toHaveLength(2);
    expect(counts).toContain('flex flex-wrap items-baseline');
    expect(markup).toContain('class="flex flex-wrap gap-2"');
    for (const pair of statPairs) {
      expect(pair).toContain('whitespace-nowrap');
      expect(pair).toMatch(/<dt[^>]*>[\s\S]*?<\/dt><dd[^>]*>\d+<\/dd>/);
      expect(pair).not.toMatch(/rounded-|border-fd-border|bg-fd-card|justify-between/);
    }

    const stylesheet = parse(await readFile(homePageContentStylesPath, 'utf8'));
    const baseCardsRule = (stylesheet.nodes ?? []).find(
      (node): node is Rule => node.type === 'rule' && node.selector === '.summaryCards',
    );
    const baseSummaryRule = (stylesheet.nodes ?? []).find(
      (node): node is Rule => node.type === 'rule' && node.selector === '.summaryActions',
    );
    const cardContainerRule = (stylesheet.nodes ?? []).find(
      (node): node is Rule => node.type === 'rule' && node.selector === '.contributionCard',
    );
    const declarations = (rule: Rule | undefined) => {
      const result: Record<string, string> = {};
      rule?.walkDecls((declaration) => { result[declaration.prop] = declaration.value; });
      return result;
    };
    const wideContainer = (stylesheet.nodes ?? []).find(
      (node): node is AtRule => node.type === 'atrule'
        && node.name === 'container'
        && node.params.startsWith('contribution-card (min-width:'),
    );
    const wideSummaryRule = wideContainer?.nodes?.find(
      (node): node is Rule => node.type === 'rule' && node.selector === '.summaryActions',
    );

    expect(declarations(baseCardsRule)).toMatchObject({
      display: 'grid',
      'grid-template-columns': 'minmax(0, 1fr)',
      'align-items': 'start',
    });
    const summaryCardRules: Rule[] = [];
    stylesheet.walkRules('.summaryCards', (rule) => { summaryCardRules.push(rule); });
    expect(summaryCardRules).toHaveLength(1);
    expect(declarations(cardContainerRule)).toMatchObject({
      'container-name': 'contribution-card',
      'container-type': 'inline-size',
    });
    expect(declarations(baseSummaryRule)).toMatchObject({ display: 'flex', 'flex-direction': 'column' });
    expect(wideContainer).toBeDefined();
    expect(declarations(wideSummaryRule)).toMatchObject({
      'flex-direction': 'row',
      'align-items': 'center',
      'justify-content': 'space-between',
    });
  });
});

describe('homepage title treatment', () => {
  it('renders the site name as a styled primary heading', async () => {
    const element = await HomePage({ params: Promise.resolve({ lang: 'zh-tw' }) });
    const markup = renderToStaticMarkup(element);
    const titleClassNames = markup.match(/<h1 id="home-title" class="([^"]+)">/)?.[1];

    expect(markup).toContain('<section aria-labelledby="home-title"');
    expect(titleClassNames?.split(' ')).toEqual(
      expect.arrayContaining(siteHomeTitleClassName.split(' ')),
    );
  });

  it('shares the fixed 24-second eight-color neon cycle and preserves forced-color accessibility', async () => {
    const stylesheet = parse(await readFile(siteEffectsStylesPath, 'utf8'));
    const animations = new Map<string, AtRule>();
    stylesheet.walkAtRules('keyframes', (rule) => { animations.set(rule.params, rule); });

    expect([...animations.keys()]).toEqual(['siteTitleGlow']);
    const rules = new Map(
      (stylesheet.nodes ?? [])
        .filter((node): node is import('postcss').Rule => node.type === 'rule')
        .map((rule) => [rule.selector, rule]),
    );
    const declarations = (selector: string) => {
      const result: Record<string, string> = {};
      const rule = rules.get(selector)
        ?? [...rules.values()].find((candidate) => candidate.selectors.includes(selector));
      rule?.walkDecls((declaration) => { result[declaration.prop] = declaration.value; });
      return result;
    };
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const homeOpacity = declarations('.site-title-glow--home');
    const pageOpacity = declarations('.site-title-glow');
    const titleRule = declarations('.site-title-glow');

    expect(titleRule.animation).toBe('siteTitleGlow 24s linear infinite');
    expect(titleRule['animation-delay']).toBe('var(--site-title-glow-delay)');
    expect(declarations(':root')['--site-title-glow-delay']).toBe('0s');
    expect(stylesheet.toString()).not.toContain('data-visual-effects');
    expect(stylesheet.toString()).not.toContain('site-effects-toggle');
    expect(titleRule['text-shadow']).toContain('0 0 4px');
    expect(titleRule['text-shadow']).toContain('0 0 15px');
    expect(titleRule['text-shadow']).toContain('0 0 32px');
    expect(homeOpacity).toMatchObject({
      '--site-title-glow-core-opacity': '0.5625',
      '--site-title-glow-main-opacity': '0.495',
      '--site-title-glow-outer-opacity': '0.3075',
    });
    expect(pageOpacity).toMatchObject({
      '--site-title-glow-core-opacity': '0.28125',
      '--site-title-glow-main-opacity': '0.2475',
      '--site-title-glow-outer-opacity': '0.15375',
    });
    const inkRules = [...(stylesheet.nodes ?? [])].filter((node) => node.type === 'rule');
    const palette = Object.fromEntries(
      inkRules.flatMap((rule) => rule.type === 'rule'
        ? rule.nodes
          ?.filter((node): node is import('postcss').Declaration => node.type === 'decl' && node.prop.startsWith('--site-title-ink-'))
          .map((declaration) => [declaration.prop, declaration.value]) ?? []
        : []),
    );
    expect(Object.keys(palette)).toHaveLength(8);
    expect(palette).toMatchObject({
      '--site-title-ink-purple': '#b9acff',
      '--site-title-ink-green': '#78ffa1',
      '--site-title-ink-red': '#ff9c9c',
      '--site-title-ink-orange': '#ffc488',
      '--site-title-ink-violet': '#e5a3ff',
      '--site-title-ink-blue': '#91abff',
      '--site-title-ink-pink': '#ffabc6',
      '--site-title-ink-cyan': '#86e9df',
    });

    const glowFrames = animations.get('siteTitleGlow')?.nodes?.filter((node) => node.type === 'rule') ?? [];
    expect(glowFrames.map((frame) => frame.selector)).toEqual([
      '0%, 4.1666667%',
      '12.5%, 16.6666667%',
      '25%, 29.1666667%',
      '37.5%, 41.6666667%',
      '50%, 54.1666667%',
      '62.5%, 66.6666667%',
      '75%, 79.1666667%',
      '87.5%, 91.6666667%',
      '100%',
    ]);
    const glowFrameValues = glowFrames.map((frame) => {
      const declarations: Record<string, string> = {};
      frame.walkDecls((declaration) => { declarations[declaration.prop] = declaration.value; });
      expect(Object.keys(declarations).sort()).toEqual(['color', 'text-shadow']);
      const hue = declarations.color.match(/^var\(--site-title-ink-(.+)\)$/)?.[1];
      expect(hue).toBeTruthy();
      expect(declarations['text-shadow']).toContain(`var(--site-title-shadow-${hue})`);
      expect(declarations['text-shadow']).toContain('0 0 4px');
      expect(declarations['text-shadow']).toContain('0 0 15px');
      expect(declarations['text-shadow']).toContain('0 0 32px');
      return declarations;
    });
    expect(glowFrameValues.map((frame) => frame.color)).toEqual([
      'var(--site-title-ink-blue)',
      'var(--site-title-ink-purple)',
      'var(--site-title-ink-violet)',
      'var(--site-title-ink-pink)',
      'var(--site-title-ink-red)',
      'var(--site-title-ink-orange)',
      'var(--site-title-ink-green)',
      'var(--site-title-ink-cyan)',
      'var(--site-title-ink-blue)',
    ]);
    expect(glowFrameValues[0]).toEqual(glowFrameValues[glowFrameValues.length - 1]);

    const reducedMotionRules: AtRule[] = [];
    const forcedColors: Record<string, string> = {};
    stylesheet.walkAtRules('media', (rule) => {
      if (rule.params === '(prefers-reduced-motion: reduce)') {
        reducedMotionRules.push(rule);
      }
      if (rule.params === '(forced-colors: active)') {
        rule.walkDecls((declaration) => { forcedColors[declaration.prop] = declaration.value; });
      }
    });
    expect(reducedMotionRules).toHaveLength(0);
    expect(animations.has('siteTitleInk')).toBe(false);
    expect(forcedColors).toMatchObject({
      animation: 'none',
      color: 'CanvasText',
      'text-shadow': 'none',
      'forced-color-adjust': 'auto',
    });
    const articleHeading = declarations('[data-site-article-heading]');
    expect(articleHeading.color).toBe('#e3d449');
    expect(normalize(articleHeading['text-shadow']))
      .toBe('0 0 3px rgb(227 212 73 / 0.35), 0 0 10px rgb(227 212 73 / 0.18)');
    expect(declarations('.site-home-section-heading')).toEqual(articleHeading);
    expect(declarations('.site-tool-section-heading')).toEqual(articleHeading);
    const sharedHeadingRules = [...rules.values()].filter((rule) =>
      ['[data-site-article-heading]', '.site-home-section-heading', '.site-tool-section-heading']
        .some((selector) => rule.selectors.includes(selector)),
    );
    expect(sharedHeadingRules).toHaveLength(1);
    expect(sharedHeadingRules[0].selectors).toEqual([
      '.site-home-section-heading',
      '.site-tool-section-heading',
      '[data-site-article-heading]',
    ]);
  });
});
