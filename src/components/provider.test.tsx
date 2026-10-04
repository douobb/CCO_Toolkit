import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const { captured } = vi.hoisted(() => ({
  captured: { theme: null as Record<string, unknown> | null },
}));

vi.mock('fumadocs-ui/provider/next', () => ({
  RootProvider: ({ children, ...props }: { children?: unknown; [key: string]: unknown }) => {
    captured.theme = props.theme as Record<string, unknown>;
    return children;
  },
}));
vi.mock('fumadocs-ui/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fumadocs-ui/i18n')>();
  return { ...actual, i18nProvider: () => ({ locale: 'en' }) };
});
vi.mock('@/components/search', () => ({ default: () => null }));
vi.mock('fumadocs-core/framework', () => ({ usePathname: () => '/en' }));
vi.mock('@/components/shared-user-inputs', () => ({
  SharedUserInputsProvider: ({ children }: { children?: unknown }) => children,
}));

import { Provider } from './provider';

describe('root theme configuration', () => {
  it('forces dark, ignores system and legacy storage, and disables the theme hotkey', () => {
    renderToStaticMarkup(<Provider locale="en">ready</Provider>);

    expect(captured.theme).toMatchObject({
      attribute: 'class',
      defaultTheme: 'dark',
      forcedTheme: 'dark',
      enableSystem: false,
      enableColorScheme: true,
      hotKey: false,
      storageKey: 'cco-toolkit:fixed-color-scheme',
    });
    expect(captured.theme?.storageKey).not.toBe('theme');
  });
});
