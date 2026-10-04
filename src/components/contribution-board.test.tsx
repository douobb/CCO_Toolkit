import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ContributionBoard, ContributionHighlights } from './contribution-board';
import type { ContributionBoardItem } from '@/lib/contribution-board';

function item(overrides: Partial<ContributionBoardItem> = {}): ContributionBoardItem {
  return {
    id: 'incomplete:guides/example',
    kind: 'incomplete',
    path: 'guides/example',
    section: 'guides',
    title: 'Example page',
    href: '/zh-tw/guides/example',
    sourceLocale: 'zh-tw',
    ...overrides,
  };
}

describe('contribution board UI', () => {
  it('renders both groups, source links, and target locale labels', () => {
    const markup = renderToStaticMarkup(
      <ContributionBoard
        locale="zh-tw"
        items={[
          item(),
          item({
            id: 'translation:tools/example:zh-tw',
            kind: 'translation',
            path: 'tools/example',
            section: 'tools',
            title: 'Tool page',
            href: '/zh-tw/tools/example',
            targetLocale: 'zh-tw',
          }),
          item({
            id: 'translation:tools/example-zh-cn:zh-cn',
            kind: 'translation',
            path: 'tools/example-zh-cn',
            section: 'tools',
            title: '简体中文目标',
            href: '/zh-tw/tools/example-zh-cn',
            targetLocale: 'zh-cn',
          }),
        ]}
      />,
    );

    expect(markup).toContain('data-contribution-board');
    expect(markup).toContain('data-contribution-group="incomplete"');
    expect(markup).toContain('data-contribution-group="translation"');
    expect(markup).toContain('Example page');
    expect(markup).toContain('href="/zh-tw/tools/example"');
    expect(markup).toContain('目標語系');
    expect(markup).toContain('簡體中文');
  });

  it('shows a clear empty state for both groups', () => {
    const markup = renderToStaticMarkup(<ContributionBoard locale="en" items={[]} />);

    expect(markup).toContain('There is no incomplete content right now.');
    expect(markup).toContain('There are no items waiting for translation into the selected language.');
  });

  it('defaults the translation filter to the current locale', () => {
    const markup = renderToStaticMarkup(
      <ContributionBoard
        locale="zh-tw"
        items={[
          item({
            id: 'translation:guides/english-target:en',
            kind: 'translation',
            title: 'English target',
            targetLocale: 'en',
          }),
          item({
            id: 'translation:guides/chinese-target:zh-tw',
            kind: 'translation',
            title: 'Chinese target',
            targetLocale: 'zh-tw',
          }),
        ]}
      />,
    );

    expect(markup).toContain('data-contribution-translation-filter=""');
    expect(markup).toContain('value="zh-tw" selected=""');
    expect(markup).toContain('Chinese target');
    expect(markup).not.toContain('English target');
  });

  it('renders the requested deterministic number of highlights', () => {
    const items = Array.from({ length: 5 }, (_, index) =>
      item({
        id: `incomplete:guides/example-${index}`,
        path: `guides/example-${index}`,
        href: `/en/guides/example-${index}`,
        title: `Example ${index}`,
      }),
    );
    const markup = renderToStaticMarkup(<ContributionHighlights locale="en" items={items} limit={3} seed="test" />);

    expect(markup.match(/data-contribution-item=/g)).toHaveLength(3);
  });

  it('keeps incomplete highlights and only current-locale translations', () => {
    const markup = renderToStaticMarkup(
      <ContributionHighlights
        locale="zh-tw"
        items={[
          item({ id: 'incomplete:guides/incomplete', path: 'guides/incomplete', title: 'Incomplete' }),
          item({
            id: 'translation:guides/chinese:zh-tw',
            kind: 'translation',
            path: 'guides/chinese',
            title: 'Chinese translation',
            targetLocale: 'zh-tw',
          }),
          item({
            id: 'translation:guides/english:en',
            kind: 'translation',
            path: 'guides/english',
            title: 'English translation',
            targetLocale: 'en',
          }),
        ]}
        limit={10}
      />,
    );

    expect(markup).toContain('Incomplete');
    expect(markup).toContain('Chinese translation');
    expect(markup).not.toContain('English translation');
  });
});
