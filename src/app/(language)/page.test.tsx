import { readFile } from 'node:fs/promises';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));
vi.mock('@/components/provider', () => ({
  Provider: ({ children, locale }: { children: ReactNode; locale: string }) => (
    <div data-provider-locale={locale}>{children}</div>
  ),
}));
vi.mock('@/app/global.css', () => ({}));
vi.mock('@/lib/contribution-board-source', () => ({
  getContributionBoard: () => [],
}));

import LanguagePage from './page';
import LocaleHomePage from '../[lang]/(home)/page';
import LocaleHomeLayout from '../[lang]/(home)/layout';
import LanguageRootLayout from './layout';
import { defaultLocale } from '@/lib/i18n';
import { baseOptions } from '@/lib/layout.shared';

function getImageUrl(images: unknown): string | undefined {
  const image = Array.isArray(images) ? images[0] : images;
  if (typeof image === 'string') return image;
  if (image instanceof URL) return image.toString();
  if (typeof image === 'object' && image !== null && 'url' in image) {
    return String(image.url);
  }
  return undefined;
}

describe('root language route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('server-renders the same default-locale homepage with locale-prefixed card links', async () => {
    const rootMarkup = renderToStaticMarkup(LanguagePage().props.children);
    const localizedPage = await LocaleHomePage({ params: Promise.resolve({ lang: 'zh-tw' }) });
    const localizedMarkup = renderToStaticMarkup(localizedPage);

    expect(rootMarkup).toBe(localizedMarkup);
    expect(rootMarkup).toContain('href="/zh-tw/tools"');
    expect(rootMarkup).toContain('href="/zh-tw/guides"');
    expect(rootMarkup).toContain('href="/zh-tw/settings"');
    expect(rootMarkup).not.toContain('更多資源');
    expect(rootMarkup).toMatch(/<h2 id="home-secondary-heading" class="[^"]*site-home-section-heading/);
    expect(rootMarkup).not.toContain('前往繁體中文首頁');

    const links = Array.from(rootMarkup.matchAll(/href="([^"]+)"/g), (match) => match[1]);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((href) => href.startsWith('/zh-tw/'))).toBe(true);
  });

  it('uses the localized HomeLayout with default-locale navigation and the main-content target', async () => {
    const rootShell = LanguagePage();
    const localizedShell = await LocaleHomeLayout({
      children: <main />,
      params: Promise.resolve({ lang: defaultLocale }),
    });
    const { children: rootChildren, ...rootOptions } = rootShell.props;
    const { children: _localizedChildren, ...localizedOptions } = localizedShell.props;

    expect(rootShell.type).toBe(localizedShell.type);
    expect(rootOptions).toEqual({ ...baseOptions(defaultLocale), id: 'main-content' });
    expect(rootOptions).toEqual(localizedOptions);
    expect(rootOptions.nav).toMatchObject({ title: 'CCO Toolkit', url: '/zh-tw' });
    expect(rootOptions.links).toEqual([
      { text: '工具', url: '/zh-tw/tools', active: 'nested-url' },
      { text: '教學', url: '/zh-tw/guides', active: 'nested-url' },
      { text: '文章', url: '/zh-tw/blog', active: 'nested-url' },
      { text: '推薦', url: '/zh-tw/recommendations', active: 'nested-url' },
      { text: '關於', url: '/zh-tw/about', active: 'nested-url' },
    ]);
    expect(rootChildren.props.locale).toBe(defaultLocale);
  });

  it('renders directly without client-side navigation or redirects', async () => {
    const source = await readFile(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).not.toContain("'use client'");
    expect(source).not.toContain('useRouter');
    expect(source).not.toContain('redirect(');
  });

  it('uses zh-Hant on the root document and the same flex page shell', () => {
    const markup = renderToStaticMarkup(
      <LanguageRootLayout><main>首頁</main></LanguageRootLayout>,
    );

    expect(markup).toContain('<html lang="zh-Hant"');
    expect(markup).toContain('<body class="flex min-h-screen flex-col">');
    expect(markup).toContain('data-provider-locale="zh-tw"');
  });

  it('emits complete Traditional Chinese social metadata for a GitHub Pages basePath', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://douobb.github.io');
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/CCO_Toolkit');
    vi.resetModules();

    const { metadata } = await import('./layout');

    expect(metadata.title).toBe('CCO Toolkit｜CyberCode Online 工具與教學');
    expect(metadata.description).toBe('CyberCode Online 的計算工具與遊戲教學。');
    expect(metadata.metadataBase).toEqual(new URL('https://douobb.github.io'));
    expect(metadata.alternates?.canonical).toBe('/CCO_Toolkit/zh-tw');
    expect(metadata.openGraph).toMatchObject({
      title: 'CCO Toolkit｜CyberCode Online 工具與教學',
      description: 'CyberCode Online 的計算工具與遊戲教學。',
      type: 'website',
      siteName: 'CCO Toolkit',
      url: '/CCO_Toolkit/zh-tw',
      locale: 'zh_TW',
      images: [{ url: '/CCO_Toolkit/images/brand/og-cover.jpg', alt: '賽博城市' }],
    });
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'CCO Toolkit｜CyberCode Online 工具與教學',
      description: 'CyberCode Online 的計算工具與遊戲教學。',
      images: [{ url: '/CCO_Toolkit/images/brand/og-cover.jpg', alt: '賽博城市' }],
    });

    const imageUrl = getImageUrl(metadata.openGraph?.images);
    expect(new URL(imageUrl!, metadata.metadataBase!).href).toBe(
      'https://douobb.github.io/CCO_Toolkit/images/brand/og-cover.jpg',
    );
    expect(new URL(getImageUrl(metadata.twitter?.images)!, metadata.metadataBase!).href).toBe(
      'https://douobb.github.io/CCO_Toolkit/images/brand/og-cover.jpg',
    );
  });
});
