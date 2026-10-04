import { describe, expect, it } from 'vitest';
import {
  defaultLocale,
  getHtmlLanguage,
  getIntlLocale,
  getListSeparator,
  getTranslationAvailability,
  i18n,
  isLocale,
  suggestLocale,
  toLocalePath,
} from './i18n';
import { getMessages } from './translations';

describe('i18n 設定', () => {
  it('固定 Static-first 所需的 locale 與 fallback 行為', () => {
    expect(i18n.languages).toEqual(['zh-tw', 'zh-cn', 'en']);
    expect(i18n.defaultLanguage).toBe('zh-tw');
    expect(i18n.hideLocale).toBe('never');
    expect(i18n.parser).toBe('dot');
    expect(i18n.fallbackLanguage).toBeNull();
  });

  it('只接受已定義的 locale', () => {
    expect(isLocale('zh-tw')).toBe(true);
    expect(isLocale('zh-cn')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('zh-TW')).toBe(false);
    expect(isLocale('fr')).toBe(false);
  });

  it('產生一致的 locale URL', () => {
    expect(toLocalePath('zh-tw')).toBe('/zh-tw');
    expect(toLocalePath('zh-cn', '/tools')).toBe('/zh-cn/tools');
    expect(toLocalePath('en', '/tools')).toBe('/en/tools');
    expect(toLocalePath('en', 'guides/getting-started')).toBe(
      '/en/guides/getting-started',
    );
    expect(toLocalePath(defaultLocale, '/')).toBe('/zh-tw');
  });

  it('從瀏覽器語言提供建議但保留繁中預設', () => {
    expect(suggestLocale(['en-US', 'zh-TW'])).toBe('en');
    expect(suggestLocale(['ja-JP', 'zh-Hant-TW'])).toBe('zh-tw');
    expect(suggestLocale(['zh-CN'])).toBe('zh-cn');
    expect(suggestLocale(['zh-Hans-SG'])).toBe('zh-cn');
    expect(suggestLocale(['fr-FR'])).toBe('zh-tw');
  });

  it('提供 HTML 語言與對應語言', () => {
    expect(getHtmlLanguage('zh-tw')).toBe('zh-TW');
    expect(getHtmlLanguage('zh-cn')).toBe('zh-CN');
    expect(getHtmlLanguage('en')).toBe('en');
    expect(getIntlLocale('zh-tw')).toBe('zh-TW');
    expect(getIntlLocale('zh-cn')).toBe('zh-CN');
    expect(getIntlLocale('en')).toBe('en-US');
    expect(getListSeparator('zh-tw')).toBe('、');
    expect(getListSeparator('zh-cn')).toBe('、');
    expect(getListSeparator('en')).toBe(', ');
  });

  it('三種語言字典具有完整結構與可用的首頁、缺頁訊息', () => {
    const leafPaths = (value: unknown, prefix = ''): string[] => {
      if (typeof value !== 'object' || value === null) return [prefix];
      return Object.entries(value).flatMap(([key, child]) =>
        leafPaths(child, prefix ? `${prefix}.${key}` : key),
      );
    };
    expect(leafPaths(getMessages('zh-cn'))).toEqual(leafPaths(getMessages('zh-tw')));
    expect(leafPaths(getMessages('en'))).toEqual(leafPaths(getMessages('zh-tw')));
    expect(getMessages('zh-cn').home.primary.toolsTitle).toBe('工具');
    expect(getMessages('zh-cn').home.primary.guidesTitle).toBe('教程');
    expect(getMessages('zh-cn').languageSelector.subtitle).toBe('选择你的语言');
    expect(getMessages('zh-cn').languageSelector.enterSite).toBe('进入网站 →');
    expect(getMessages('zh-cn').translationUnavailable.title).toContain('简体中文');
    expect(getMessages('zh-tw').home.primary.toolsTitle).toBe('Tools');
    expect(getMessages('zh-tw').home.primary.toolsLink).toBe('查看所有工具');
    expect(getMessages('zh-tw').home.primary.guidesLink).toBe('瀏覽教學');
    expect(getMessages('zh-cn').home.primary.toolsLink).toBe('查看所有工具');
    expect(getMessages('zh-cn').home.primary.guidesLink).toBe('浏览教程');
    expect(getMessages('en').home.primary.guidesTitle).toBe('Guides');
    expect(getMessages('en').home.primary.toolsLink).toBe('View all tools');
    expect(getMessages('en').home.primary.guidesLink).toBe('Browse guides');
    expect(getMessages('en').contributionBoard.translationTitle).toBe('Needs translation');
    expect(getMessages('en').translationUnavailable.title).toContain('not available');
  });

  it('三種語言都提供完整且各自翻譯的站長簡介訊息', () => {
    const fields = [
      'avatarAlt',
      'introduction',
      'contactLabel',
      'contactText',
      'noteLabel',
      'noteText',
    ] as const;
    const ownerMessages = (['zh-tw', 'zh-cn', 'en'] as const).map(
      (locale) => getMessages(locale).aboutPage.ownerProfile,
    );

    for (const field of fields) {
      const translations = ownerMessages.map((messages) => messages[field].trim());
      expect(translations.every(Boolean)).toBe(true);
      expect(new Set(translations).size).toBe(3);
    }
    expect(getMessages('zh-tw').aboutPage.ownerProfile.noteText).toBe(
      '這個人很懶，什麼都沒留下',
    );
  });

  it('只在非預設語系缺少翻譯且預設來源存在時顯示 unavailable', () => {
    expect(getTranslationAvailability('en', true, true)).toBe('available');
    expect(getTranslationAvailability('en', false, true)).toBe('unavailable');
    expect(getTranslationAvailability('en', false, false)).toBe('not-found');
    expect(getTranslationAvailability('zh-tw', false, true)).toBe('not-found');
    expect(getTranslationAvailability('zh-cn', true, true)).toBe('available');
    expect(getTranslationAvailability('zh-cn', false, true)).toBe('unavailable');
    expect(getTranslationAvailability('zh-cn', false, false)).toBe('not-found');
  });
});
