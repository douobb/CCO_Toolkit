import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const rootLayouts = [
  new URL('./[lang]/layout.tsx', import.meta.url),
  new URL('./(language)/layout.tsx', import.meta.url),
];

describe('dark root layouts', () => {
  it.each(rootLayouts)('server-renders a fixed dark html root without an effects bootstrap: %s', async (path) => {
    const source = await readFile(path, 'utf8');

    expect(source).toContain('className="dark"');
    expect(source).toContain("style={{ colorScheme: 'dark' }}");
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
});
