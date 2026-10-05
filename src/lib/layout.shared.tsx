import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { LanguageSelectText } from 'fumadocs-ui/layouts/shared/slots/language-select';
import {
  ToolPlayerSettingsHeaderLink,
  ToolPlayerSettingsLanguageSelect,
} from '@/components/tool-player-settings-link';
import type { Locale } from './i18n';
import { toLocalePath } from './i18n';
import { appName, getGitConfig, projectRepositoryUrl } from './shared';
import { getMessages } from './translations';

export function getNavigationLinks(locale: Locale): NonNullable<BaseLayoutProps['links']> {
  const navigation = getMessages(locale).navigation;

  return [
    {
      text: navigation.tools,
      url: toLocalePath(locale, 'tools'),
      active: 'nested-url',
    },
    {
      text: navigation.guides,
      url: toLocalePath(locale, 'guides'),
      active: 'nested-url',
    },
    {
      text: navigation.blog,
      url: toLocalePath(locale, 'blog'),
      active: 'nested-url',
    },
    {
      text: navigation.recommendations,
      url: toLocalePath(locale, 'recommendations'),
      active: 'nested-url',
    },
    {
      text: navigation.about,
      url: toLocalePath(locale, 'about'),
      active: 'nested-url',
    },
  ];
}

export function baseOptions(locale: Locale): BaseLayoutProps {
  const gitConfig = getGitConfig();

  return {
    nav: {
      title: appName,
      url: toLocalePath(locale),
    },
    links: getNavigationLinks(locale),
    themeSwitch: { enabled: false },
    githubUrl: gitConfig ? `https://github.com/${gitConfig.user}/${gitConfig.repo}` : projectRepositoryUrl,
  };
}

export function docsOptions(locale: Locale): BaseLayoutProps {
  const options = baseOptions(locale);

  return {
    ...options,
    links: [],
    nav: {
      ...options.nav,
      children: (
        <div data-cco-tool-header-settings-slot="" className="hidden max-md:flex items-center justify-end gap-1">
          <ToolPlayerSettingsHeaderLink />
        </div>
      ),
    },
    slots: {
      ...options.slots,
      languageSelect: {
        root: ToolPlayerSettingsLanguageSelect,
        text: LanguageSelectText,
      },
    },
  };
}
