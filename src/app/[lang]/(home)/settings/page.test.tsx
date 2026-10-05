import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const nextLinkFixture = vi.hoisted(() => ({
  receivedHrefs: [] as string[],
}));

vi.mock('next/link', async () => {
  const React = await import('react');
  const { withBasePath } = await import('@/lib/site-paths');

  return {
    default: ({ href, ...props }: ComponentProps<'a'> & { href: string }) => {
      nextLinkFixture.receivedHrefs.push(href);
      return React.createElement('a', { ...props, href: withBasePath(href) });
    },
  };
});

vi.mock('@/components/shared-user-inputs', () => ({
  SharedUserInputsManager: () => <div data-shared-inputs="true" />,
}));
vi.mock('@/components/player-data-manager', () => ({
  PlayerDataManager: () => <div data-player-data="true" />,
}));
vi.mock('@/lib/contribution-board-source', () => ({
  getContributionBoard: () => [],
}));

import SettingsPage from './page';
import { HomePageContent } from '@/components/home-page-content';
import { toLocalePath } from '@/lib/i18n';
import { getMessages } from '@/lib/translations';
import { siteBasePath } from '@/lib/site-paths';

describe('獨立設定頁與首頁設定入口', () => {
  it.each(['zh-tw', 'zh-cn', 'en'] as const)('首頁的 %s 設定入口是無來源參數的一般站內連結', (locale) => {
    nextLinkFixture.receivedHrefs.length = 0;
    const markup = renderToStaticMarkup(<HomePageContent locale={locale} />);
    const rawSettingsHref = toLocalePath(locale, 'settings');
    const renderedSettingsHref = siteBasePath
      ? `${siteBasePath}${rawSettingsHref}`
      : rawSettingsHref;

    expect(nextLinkFixture.receivedHrefs).toContain(rawSettingsHref);
    expect(markup).toContain(`href="${renderedSettingsHref}"`);
    expect(markup).not.toContain(`href="${renderedSettingsHref}?`);
    expect(markup).not.toContain('data-cco-player-settings-link');
  });

  it.each(['zh-tw', 'zh-cn', 'en'] as const)('SSR 輸出 %s 完整共用設定與資料管理頁', async (locale) => {
    const page = await SettingsPage({ params: Promise.resolve({ lang: locale }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<h1');
    expect(markup).toContain(getMessages(locale).settingsPage.title.replace(/&/g, '&amp;'));
    expect(markup).toContain('data-shared-inputs="true"');
    expect(markup).toContain('data-player-data="true"');
  });
});
