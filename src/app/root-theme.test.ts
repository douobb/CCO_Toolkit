import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const rootLayouts = [
  new URL('./[lang]/layout.tsx', import.meta.url),
  new URL('./(language)/layout.tsx', import.meta.url),
];

describe('dark root layouts', () => {
  it.each(rootLayouts)('keeps the fixed dark html root and parser-synchronous title phase bootstrap: %s', async (path) => {
    const source = await readFile(path, 'utf8');

    expect(source).toContain('className="dark"');
    expect(source).toContain("style={{ colorScheme: 'dark' }}");
    expect(source).toContain('<style id={SITE_TITLE_PHASE_STYLE_ID}></style>');
    expect(source).toContain('dangerouslySetInnerHTML={{ __html: SITE_TITLE_PHASE_BOOTSTRAP_SCRIPT }}');
    expect(source.indexOf('<style')).toBeLessThan(source.indexOf('<script'));
    expect(source).not.toContain("from 'next/script'");
    expect(source).not.toContain('data-visual-effects');
    expect(source).not.toContain('visualEffectsBootstrapScript');
    expect(source).not.toContain('localStorage');
  });

  it('keeps color-scheme dark in the root stylesheet', async () => {
    const stylesheet = await readFile(new URL('./global.css', import.meta.url), 'utf8');

    expect(stylesheet).toContain('color-scheme: dark;');
    expect(stylesheet).toContain("@import './site-effects.css';");
  });

  it('keeps the title animation independent from any saved visual-effects preference', async () => {
    const stylesheet = await readFile(new URL('./site-effects.css', import.meta.url), 'utf8');

    expect(stylesheet).toContain('animation: siteTitleGlow 24s linear infinite;');
    expect(stylesheet).not.toContain('data-visual-effects');
    expect(stylesheet).not.toContain('prefers-reduced-motion');
  });

  it('sets weight 700 only on the main title and semantic article headings', async () => {
    const stylesheet = await readFile(new URL('./site-effects.css', import.meta.url), 'utf8');

    expect(stylesheet).toContain('h1.site-title-glow');
    expect(stylesheet).toContain('h1[data-site-article-heading]');
    expect(stylesheet).toContain('h2[data-site-article-heading]');
    expect(stylesheet).toContain('h3[data-site-article-heading]');
    expect(stylesheet).toContain('font-weight: 700;');
    expect(stylesheet).not.toContain('body {\n  font-weight');
    expect(stylesheet).not.toContain('nav {\n  font-weight');
    expect(stylesheet).not.toContain('label {\n  font-weight');
  });
});
