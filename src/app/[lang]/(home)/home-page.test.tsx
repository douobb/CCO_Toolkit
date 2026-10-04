import { readFile } from 'node:fs/promises';
import { parse, type AtRule } from 'postcss';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import HomePage from './page';
import { siteHomeTitleClassName } from '@/components/site-page-title';

const siteEffectsStylesPath = new URL('../../../app/site-effects.css', import.meta.url);

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
  ],
}));

describe('home page information architecture', () => {
  it('renders the primary, contribution, and secondary links without homepage-only helper promotion', async () => {
    const element = await HomePage({ params: Promise.resolve({ lang: 'zh-tw' }) });
    const markup = renderToStaticMarkup(element);

    expect(markup).toContain('href="/zh-tw/tools"');
    expect(markup).toContain('href="/zh-tw/guides"');
    expect(markup).toContain('查看所有工具');
    expect(markup).toContain('瀏覽教學');
    expect(markup).not.toContain('href="/zh-tw/guides/new-player"');
    expect(markup).not.toContain('href="/zh-tw/tools/helper-overview"');
    expect(markup).not.toContain('CCO Helper');
    expect(markup).not.toContain('核心入口');
    expect(markup).not.toContain('home-primary-heading');
    expect(markup.match(/site-home-section-heading/g)).toHaveLength(3);
    expect(markup.match(/<h2 id="home-contribution-heading" class="([^"]+)"/)?.[1])
      .toContain('site-home-section-heading');
    expect(markup.match(/<h2 id="home-secondary-heading" class="([^"]+)"/)?.[1])
      .not.toContain('site-home-section-heading');
    expect(markup).toContain('href="/zh-tw/settings"');
    expect(markup).toContain('href="/zh-tw/about/contribution-board"');
    expect(markup).toContain('href="/zh-tw/about/contributing"');
    expect(markup).toContain('href="/zh-tw/blog"');
    expect(markup).toContain('href="/zh-tw/recommendations"');
    expect(markup).toContain('href="/zh-tw/about"');
    expect(markup).toContain('Chinese target contribution');
    expect(markup).not.toContain('English target contribution');
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
    expect(declarations('.site-home-section-heading')).toMatchObject({
      color: '#e3d449',
      'text-shadow': '0 0 2px rgb(227 212 73 / 0.16)',
    });
    expect(declarations('.site-tool-section-heading')).toMatchObject({
      color: '#e3d449',
      'text-shadow': '0 0 2px rgb(227 212 73 / 0.16)',
    });
  });
});
