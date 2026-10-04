import { createElement, type ComponentType, type ComponentProps } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { describe, expect, it, vi } from 'vitest';

import { getMDXComponents } from './mdx';

vi.mock('@fuma-translate/react', () => ({
  useTranslations: () => (label: string) => label,
}));

describe('scoped MDX article headings', () => {
  it('also styles the tool MDX explanations without styling tool-renderer headings', () => {
    const route = readFileSync(new URL('../app/[lang]/(site)/[section]/[[...slug]]/page.tsx', import.meta.url), 'utf8');
    expect(route).toContain('{ articleHeadings: true }');
    expect(route).not.toContain('articleHeadings: !toolDefinition');
  });
  it('marks only article h1/h2 headings and leaves h3 untouched', () => {
    const articleComponents = getMDXComponents(undefined, { articleHeadings: true });
    const toolComponents = getMDXComponents(undefined, { articleHeadings: false });
    const ArticleH1 = articleComponents.h1 as ComponentType<ComponentProps<'h1'>>;
    const ArticleH2 = articleComponents.h2 as ComponentType<ComponentProps<'h2'>>;
    const renderedH1 = renderToStaticMarkup(
      createElement(ArticleH1, { id: 'test-heading' }, 'Article title'),
    );
    const renderedH2 = renderToStaticMarkup(
      createElement(ArticleH2, { id: 'test-heading' }, 'Article section'),
    );

    expect(renderedH1).toContain('data-site-article-heading=""');
    expect(renderedH2).toContain('site-article-heading');
    for (const markup of [renderedH1, renderedH2]) {
      expect(markup).toContain('href="#test-heading"');
      expect(markup).toContain('aria-label="Copy Anchor Link"');
      expect(markup).toContain('scroll-m-28');
    }
    expect(articleComponents.h3).toBe(defaultMdxComponents.h3);
    expect(toolComponents.h1).toBe(defaultMdxComponents.h1);
    expect(toolComponents.h2).toBe(defaultMdxComponents.h2);
  });
});
