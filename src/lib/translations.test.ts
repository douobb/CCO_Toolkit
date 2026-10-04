import { describe, expect, it } from 'vitest';

import { getMessages } from './translations';

describe('Blog 總覽文案', () => {
  it('三語系使用簡短的隨筆說明', () => {
    expect(getMessages('zh-tw').blogPage.description).toBe('一些廢文。');
    expect(getMessages('zh-cn').blogPage.description).toBe('一些废文。');
    expect(getMessages('en').blogPage.description).toBe('Some random ramblings.');
  });
});

describe('玩家與計算設定文案', () => {
  it('三語使用精簡描述並移除冗餘副標題', () => {
    const expectedDescriptions = {
      'zh-tw': '管理工具共用輸入。',
      'zh-cn': '管理工具共用输入。',
      en: 'Manage shared tool inputs.',
    } as const;

    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      const settingsPage = getMessages(locale).settingsPage;
      expect(settingsPage.description).toBe(expectedDescriptions[locale]);
      expect(settingsPage.dataManagement).not.toHaveProperty('description');
      for (const key of [
        'browserOnlyTitle',
        'browserOnlyDescription',
        'progressionDescription',
        'equipmentDescription',
        'economyDescription',
        'marketPricesDescription',
      ]) {
        expect(settingsPage).not.toHaveProperty(key);
      }
    }
  });
});
