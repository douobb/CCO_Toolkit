import { describe, expect, it } from 'vitest';

import type { MarketPriceItemId } from '@/data/game/economy';
import { earningsActivityCatalog } from '@/data/game/earnings-activities';
import {
  getDualPrice,
  resolveMarketPrices,
  type ResolvedMarketPrices,
} from './market-prices';
import { AI_GROUPS_PER_ACTION, calculateMining, miningDefaults } from './mining-calculator';
import {
  calculateEarnings,
  EARNINGS_ELAPSED_MINUTES,
  EARNINGS_TIME_REDUCTION_PERCENT,
  validateEarningsInputs,
} from './earnings-calculator';

const validInputs = {
  searchLevel: 500,
  printingLevel: 500,
  miningLevel: 500,
  btcBuffPercent: 0,
  bargainPercent: 0,
} as const;

function getAiItemPricePerUnit(itemId: string, prices: ResolvedMarketPrices): number {
  const price = getDualPrice(prices, itemId as MarketPriceItemId, 'ai');
  return itemId === 'tech-scrap' ? price / 1_000 : price;
}

describe('earnings calculator', () => {
  it('產生完整活動目錄並按每分鐘 AI 收益排序', () => {
    const result = calculateEarnings(validInputs, resolveMarketPrices());

    expect(result).not.toBeNull();
    expect(result?.activities).toHaveLength(16);
    expect(result?.timeReductionPercent).toBe(EARNINGS_TIME_REDUCTION_PERCENT);
    expect(result?.comparisonMode).toBe('per-minute');
    expect(result?.elapsedMinutes).toBeNull();
    expect(result?.activities[0]?.aiPerMinute).not.toBeNull();
    expect(result?.activities.every((activity) => activity.effectiveBatchMinutes > 0)).toBe(true);

    const ranked = result!.activities
      .map((activity) => activity.aiPerMinute)
      .filter((value): value is number => value !== null);
    expect(ranked).toEqual([...ranked].sort((left, right) => right - left));
  });

  it('價格變更會反映在轉換活動結果', () => {
    const defaultResult = calculateEarnings(validInputs, resolveMarketPrices());
    const changedResult = calculateEarnings(validInputs, resolveMarketPrices({
      economy: {
        prices: [{ itemId: 'tech-scrap', currencyId: 'ai', amount: 220 }],
        exchangeRates: [],
        cacheRates: [],
      },
    }));
    const defaultCrush = defaultResult?.activities.find((activity) => activity.id === 'crush-medical');
    const changedCrush = changedResult?.activities.find((activity) => activity.id === 'crush-medical');

    expect(changedCrush?.batchNetAi).not.toBe(defaultCrush?.batchNetAi);
  });

  it('四種包以單位 BTC 費用按目前匯率扣除，並正確產生整批與每分鐘收益', () => {
    const prices = resolveMarketPrices();
    expect(prices.btcPerAi).toBe(8_450);
    const calculation = calculateEarnings(validInputs, prices)!;
    const grossAiById = {
      'pack-old-pouch': 2,
      'pack-fanny-pack': 6,
      'pack-explorer-backpack': 10,
      'pack-employee-office-case': 0,
    } as const;

    for (const [id, grossAi] of Object.entries(grossAiById)) {
      const definition = earningsActivityCatalog.find((activity) => activity.id === id);
      const result = calculation.activities.find((activity) => activity.id === id);
      expect(definition?.kind).toBe('pack');
      expect(result).toBeDefined();
      if (!definition || definition.kind !== 'pack' || !result) continue;

      const grossAiFromPrices = getAiItemPricePerUnit(definition.outputItemId, prices)
        * definition.outputQuantity
        - getAiItemPricePerUnit(definition.inputItemId, prices) * definition.inputQuantity;
      expect(grossAiFromPrices).toBeCloseTo(
        grossAiById[id as keyof typeof grossAiById],
        12,
      );
      const expectedUnitNetAi = grossAiFromPrices - definition.unitBtcCost / prices.btcPerAi;
      expect(result.unitNetAi).toBeCloseTo(expectedUnitNetAi, 12);
      expect(result.batchNetAi).toBeCloseTo(expectedUnitNetAi * definition.batchSize, 12);
      expect(result.aiPerMinute).toBeCloseTo(
        (expectedUnitNetAi * definition.batchSize) / result.effectiveBatchMinutes,
        12,
      );
    }

    const employeeOfficeCase = calculation.activities.find(
      (activity) => activity.id === 'pack-employee-office-case',
    )?.unitNetAi;
    expect(employeeOfficeCase).toBeDefined();
    expect(employeeOfficeCase ?? 0).toBeLessThan(0);
  });

  it('黑市快取每批 4,000；飛逝依時間計數並封頂，單位每分鐘收益不隨批量放大', () => {
    const prices = resolveMarketPrices();
    const perMinute = calculateEarnings(validInputs, prices)!;
    const shortElapsed = calculateEarnings(validInputs, prices, {
      comparisonMode: 'elapsed-15',
    })!;
    const cappedElapsed = calculateEarnings(validInputs, prices, {
      comparisonMode: 'elapsed-105',
    })!;
    const cacheIds = [
      'black-market-trash',
      'black-market-common',
      'black-market-high-quality',
      'black-market-rare',
    ] as const;

    for (const id of cacheIds) {
      const definition = earningsActivityCatalog.find((activity) => activity.id === id);
      const batchResult = perMinute.activities.find((activity) => activity.id === id);
      const shortResult = shortElapsed.activities.find((activity) => activity.id === id);
      const cappedResult = cappedElapsed.activities.find((activity) => activity.id === id);
      if (!definition || !batchResult || !shortResult || !cappedResult) {
        throw new Error(`缺少黑市快取收益資料：${id}`);
      }

      expect(definition.kind).toBe('black-market');
      expect(definition).toMatchObject({ batchSize: 4_000, baseUnitSeconds: 7 });
      expect(batchResult.batchSize).toBe(4_000);
      expect(batchResult.effectiveBatchMinutes).toBeCloseTo(
        definition.baseUnitSeconds
          * (100 - perMinute.timeReductionPercent)
          / 100
          * 4_000
          / 60,
        12,
      );
      expect(batchResult.unitNetAi).not.toBeNull();
      const unitNetAi = batchResult.unitNetAi ?? 0;
      const effectiveUnitSeconds = definition.baseUnitSeconds
        * (100 - perMinute.timeReductionPercent)
        / 100;
      expect(batchResult.batchNetAi).toBeCloseTo(unitNetAi * 4_000, 12);
      expect(batchResult.aiPerMinute).toBeCloseTo(unitNetAi * 60 / effectiveUnitSeconds, 12);

      const expectedShortCount = Math.floor(
        (15 * 60 * 100)
          / (definition.baseUnitSeconds * (100 - shortElapsed.timeReductionPercent)),
      );
      expect(shortResult.elapsed).toMatchObject({
        count: expectedShortCount,
        usedSeconds: expectedShortCount * effectiveUnitSeconds,
      });
      expect(shortResult.elapsed?.totalNetAi)
        .toBeCloseTo((shortResult.unitNetAi ?? 0) * expectedShortCount, 12);

      expect(cappedResult.elapsed).toMatchObject({
        count: 4_000,
        usedSeconds: effectiveUnitSeconds * 4_000,
      });
      expect(cappedResult.elapsed?.totalNetAi)
        .toBeCloseTo((cappedResult.unitNetAi ?? 0) * 4_000, 12);
    }
  });

  it('自訂 BTC/AI 匯率會改變 BTC 費用的 AI 扣除額', () => {
    const defaultPrices = resolveMarketPrices();
    const customPrices = resolveMarketPrices({
      economy: {
        prices: [],
        exchangeRates: [{ id: 'btc-per-ai', value: 10_000 }],
        cacheRates: [],
      },
    });
    const defaultPack = calculateEarnings(validInputs, defaultPrices)?.activities
      .find((activity) => activity.id === 'pack-old-pouch');
    const customPack = calculateEarnings(validInputs, customPrices)?.activities
      .find((activity) => activity.id === 'pack-old-pouch');

    expect(defaultPack?.unitNetAi).not.toBeNull();
    expect(customPack?.unitNetAi).not.toBeNull();
    expect((customPack?.unitNetAi ?? 0) - (defaultPack?.unitNetAi ?? 0)).toBeCloseTo(
      500 / defaultPrices.btcPerAi - 500 / customPrices.btcPerAi,
      12,
    );
  });

  it('飛逝比較按完成次數累計單位收益，且不重複計入批次數', () => {
    const prices = resolveMarketPrices();
    const perMinute = calculateEarnings(validInputs, prices)!;
    const elapsed = calculateEarnings(validInputs, prices, { comparisonMode: 'elapsed-15' })!;
    const expected = [
      { id: 'pack-old-pouch', count: 15, unitSeconds: 300 },
      { id: 'pack-fanny-pack', count: 5, unitSeconds: 900 },
      { id: 'pack-explorer-backpack', count: 2, unitSeconds: 1_800 },
      { id: 'pack-employee-office-case', count: 1, unitSeconds: 2_700 },
    ] as const;

    for (const entry of expected) {
      const unit = perMinute.activities.find((activity) => activity.id === entry.id);
      const result = elapsed.activities.find((activity) => activity.id === entry.id);
      expect(unit?.unitNetAi).not.toBeNull();
      expect(result?.elapsed).toMatchObject({
        count: entry.count,
        usedSeconds: entry.count * entry.unitSeconds * 0.2,
      });
      expect(result?.elapsed?.totalNetAi).toBeCloseTo(
        (unit?.unitNetAi ?? 0) * entry.count,
        12,
      );
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '無效 BTC/AI 匯率 %s 不產生無限或錯誤的包收益，且 crush 維持零費用',
    (btcPerAi) => {
      const invalidPrices = { ...resolveMarketPrices(), btcPerAi };
      const perMinute = calculateEarnings(validInputs, invalidPrices)!;
      const elapsed = calculateEarnings(validInputs, invalidPrices, {
        comparisonMode: 'elapsed-15',
      })!;

      for (const id of [
        'pack-old-pouch',
        'pack-fanny-pack',
        'pack-explorer-backpack',
        'pack-employee-office-case',
      ] as const) {
        expect(perMinute.activities.find((activity) => activity.id === id)).toMatchObject({
          unitNetAi: null,
          batchNetAi: null,
          aiPerMinute: null,
        });
        expect(elapsed.activities.find((activity) => activity.id === id)?.elapsed?.totalNetAi)
          .toBeNull();
      }

      expect(perMinute.activities.find((activity) => activity.id === 'crush-medical'))
        .toMatchObject({ unitNetAi: 0.082, batchNetAi: 82 });
    },
  );

  it('以有效秒數計算飛逝次數，並在活動批次上限後停止增加', () => {
    const expectedCounts = [5, 10, 12, 12, 12];

    EARNINGS_ELAPSED_MINUTES.forEach((minutes, index) => {
      const result = calculateEarnings(validInputs, resolveMarketPrices(), {
        comparisonMode: `elapsed-${minutes}` as const,
      });
      const search = result?.activities.find((activity) => activity.id === 'search');

      expect(result?.elapsedMinutes).toBe(minutes);
      expect(search?.batchSize).toBe(12);
      expect(search?.elapsed?.count).toBe(expectedCounts[index]);
      expect(search?.elapsed?.usedSeconds).toBe(expectedCounts[index] * 180);
    });
  });

  it('以單次淨收益正確縮放挖礦與 AI 製作批次', () => {
    const result = calculateEarnings(validInputs, resolveMarketPrices());
    const mining = result?.activities.find((activity) => activity.id === 'mining');
    const aiCrafting = result?.activities.find((activity) => activity.id === 'ai-crafting');

    expect(mining?.unitNetAi).not.toBeNull();
    expect(mining?.batchNetAi).toBeCloseTo(
      (mining?.unitNetAi ?? 0) * (mining?.batchSize ?? 0),
    );
    expect(aiCrafting?.unitNetAi).not.toBeNull();
    expect(aiCrafting?.batchNetAi).toBeCloseTo(
      (aiCrafting?.unitNetAi ?? 0) * (aiCrafting?.batchSize ?? 0),
    );
  });

  it('AI 製作以一組為收益單位，整批與核心一次製作結果一致', () => {
    const result = calculateEarnings(
      { ...validInputs, miningLevel: 400 },
      resolveMarketPrices(),
    );
    const aiCrafting = result?.activities.find((activity) => activity.id === 'ai-crafting');
    const miningCore = calculateMining({ miningLevel: 400, ...miningDefaults });

    expect(AI_GROUPS_PER_ACTION).toBe(100);
    expect(miningCore?.aiCraft).toMatchObject({ groupsPerAction: 100, profitAi: 190 });
    expect(aiCrafting).toMatchObject({
      batchSize: 100,
      effectiveBatchMinutes: 100,
      unitNetAi: 1.9,
      batchNetAi: 190,
      aiPerMinute: 1.9,
    });
    expect(aiCrafting?.batchSize).toBe(miningCore?.aiCraft.groupsPerAction);
    expect(aiCrafting?.batchNetAi).toBe(miningCore?.aiCraft.profitAi);
  });

  it('零成本 Lv.400 AI 製作每組收益為 40，批次總收益為 4,000', () => {
    const prices = resolveMarketPrices({
      economy: {
        prices: [
          { itemId: 'hash', currencyId: 'ai', amount: 0 },
          { itemId: 'tech-scrap', currencyId: 'ai', amount: 0 },
        ],
        exchangeRates: [],
        cacheRates: [],
      },
    });
    const result = calculateEarnings({ ...validInputs, miningLevel: 400 }, prices);
    const aiCrafting = result?.activities.find((activity) => activity.id === 'ai-crafting');

    expect(aiCrafting).toMatchObject({ unitNetAi: 40, batchNetAi: 4_000 });
  });

  it('低等級的負收益同樣按每組正規化', () => {
    const result = calculateEarnings({ ...validInputs, miningLevel: 1 }, resolveMarketPrices());
    const aiCrafting = result?.activities.find((activity) => activity.id === 'ai-crafting');

    expect(aiCrafting).toMatchObject({ unitNetAi: -37.1, batchNetAi: -3_710 });
  });

  it('AI 製作飛逝收益按每組累計並在 100 組封頂', () => {
    const prices = resolveMarketPrices();
    const inputs = { ...validInputs, miningLevel: 400 };
    const fifteenMinutes = calculateEarnings(inputs, prices, { comparisonMode: 'elapsed-15' })
      ?.activities.find((activity) => activity.id === 'ai-crafting');
    const capped = calculateEarnings(inputs, prices, { comparisonMode: 'elapsed-105' })
      ?.activities.find((activity) => activity.id === 'ai-crafting');

    expect(fifteenMinutes?.elapsed).toMatchObject({
      count: 15,
      usedSeconds: 900,
      totalNetAi: 28.5,
    });
    expect(capped?.elapsed).toMatchObject({
      count: 100,
      usedSeconds: 6_000,
      totalNetAi: 190,
    });
  });

  it('AI 製作單位修正不改變搜索、一般挖礦與壓碎活動', () => {
    const result = calculateEarnings(validInputs, resolveMarketPrices());
    const search = result?.activities.find((activity) => activity.id === 'search');
    const mining = result?.activities.find((activity) => activity.id === 'mining');
    const crushing = result?.activities.find((activity) => activity.id === 'crush-medical');

    expect(search?.unitNetAi).toBeCloseTo(8.481941820494825, 12);
    expect(search?.batchNetAi).toBeCloseTo(101.7833018459379, 12);
    expect(mining?.unitNetAi).toBeCloseTo(-3.0281656804733728, 12);
    expect(mining?.batchNetAi).toBeCloseTo(-24.225325443786982, 12);
    expect(crushing).toMatchObject({
      batchSize: 1_000,
      effectiveBatchMinutes: 53.333333333333336,
      unitNetAi: 0.082,
      batchNetAi: 82,
    });
  });

  it('飛逝模式依指定期間內的總淨收益排序，而非每分鐘收益', () => {
    const result = calculateEarnings(validInputs, resolveMarketPrices(), {
      comparisonMode: 'elapsed-45',
    });
    const ranked = result?.activities
      .map((activity) => activity.elapsed?.totalNetAi)
      .filter((value): value is number => value !== null && value !== undefined);

    expect(ranked).toEqual([...ranked!].sort((left, right) => right - left));
  });

  it('不足完成一次時保留零次並將飛逝收益標為無法估算', () => {
    const result = calculateEarnings(validInputs, resolveMarketPrices(), {
      timeReductionPercent: 0,
      comparisonMode: 'elapsed-15',
    });
    const slowestActivity = result?.activities.find(
      (activity) => activity.id === 'pack-employee-office-case',
    );

    expect(slowestActivity?.elapsed?.count).toBe(0);
    expect(slowestActivity?.elapsed?.usedSeconds).toBe(0);
    expect(slowestActivity?.elapsed?.totalNetAi).toBeNull();
  });

  it('拒絕超出等級、BUFF 或討價還價限制的輸入', () => {
    expect(validateEarningsInputs({ ...validInputs, searchLevel: 0 })).toBe('search-level');
    expect(validateEarningsInputs({ ...validInputs, btcBuffPercent: 101 })).toBe('btc-buff');
    expect(validateEarningsInputs({ ...validInputs, bargainPercent: 41 })).toBe('bargain');
    expect(calculateEarnings({ ...validInputs, miningLevel: 801 }, resolveMarketPrices())).toBeNull();
  });
});
