import { describe, expect, it } from 'vitest';

import { getMessages } from '@/lib/translations';
import { earningsActivityCatalog } from '../earnings-activities';
import { marketCacheRateCatalog } from '../economy';
import { zhCnToolTermEntries, zhCnToolTerms } from './zh-cn-tool-terms';

describe('zh-CN 工具術語契約', () => {
  it('只從工具 Game Data 建立精簡術語映射，且同名術語不得互相衝突', () => {
    const translationsByEnglish = new Map<string, Set<string>>();

    for (const [english, simplifiedChinese] of zhCnToolTermEntries) {
      const translations = translationsByEnglish.get(english) ?? new Set<string>();
      translations.add(simplifiedChinese);
      translationsByEnglish.set(english, translations);
    }

    for (const [english, translations] of translationsByEnglish) {
      expect(
        [...translations],
        `${english} 在工具目錄中出現不一致的簡中翻譯`,
      ).toHaveLength(1);
    }

    expect(Object.keys(zhCnToolTerms).length).toBe(translationsByEnglish.size);
  });

  it('保留工具會顯示的關鍵遊戲術語', () => {
    expect(zhCnToolTerms).toMatchObject({
      'Old Pouch': '老旧袋子',
      "Explorer's Backpack": '探险家背包',
      'Tech Scrap': '科技碎片',
      'Hash Processor': '哈希处理器',
      'Supply Crate [Gang]': '补给箱[帮派]',
      'AI Core': 'AI芯片',
      'CyberTunnel VPN': '网络隧道代理',
      'Dungeon Token': '地牢令牌',
      'Calibration Accuracy': '校准精度',
      'Calibration Safety Nanobots': '校准安全纳米机器人',
      'White Box': '白箱',
      'Yellow Box': '黄箱',
      'Purple Box': '紫箱',
    });
  });

  it('遊戲 cache 只顯示图纸，不得回歸为缓存', () => {
    const messages = getMessages('zh-cn');
    const gameText = JSON.stringify({
      settings: messages.settingsPage.cacheRatesTitle,
      levelConversion: messages.tools.levelConversion,
      blackMarket: messages.tools.blackMarket,
      earnings: earningsActivityCatalog.map((activity) => activity.labels['zh-cn']),
      economy: marketCacheRateCatalog.map((rate) => rate.labels['zh-cn']),
    });

    expect(gameText).not.toContain('缓存');
    expect(gameText).toContain('废弃图纸');
    expect(gameText).toContain('普通图纸');
    expect(gameText).toContain('高级图纸');
    expect(gameText).toContain('稀有图纸');
    expect(marketCacheRateCatalog.map((rate) => rate.unit)).toEqual([
      'cache/AI',
      'cache/AI',
      'cache/AI',
      'cache/AI',
    ]);
  });
});
