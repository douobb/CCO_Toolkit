import { beforeAll, describe, expect, it } from 'vitest';

import { earningsActivityCatalog, type EarningsActivityId } from '@/data/game/earnings-activities';
import { defaultSharedUserInputs } from '@/lib/storage';
import {
  calculateEarnings,
  type EarningsActivityResult,
  type EarningsCalculation,
  type EarningsInputs,
} from './earnings-calculator';
import { calculateManualMixedCrushing } from './mixed-crushing-calculator';
import {
  deriveEarningsChartData,
  defaultEarningsChartGroupId,
  defaultEarningsChartVisibleActivityIds,
  earningsChartGroups,
  fixedEarningsChartActivityIds,
  findNearestEarningsChartSeries,
  getEarningsChartYDomain,
  getEarningsChartYScale,
  getEarningsChartYScaleTicks,
  getEarningsChartCalloutPosition,
  getFixedEarningsChartRows,
  mixedCrushingChartActivityId,
  type EarningsChartData,
  type EarningsChartPoint,
} from './earnings-chart';
import { resolveMarketPrices } from './market-prices';

const inputs: EarningsInputs = {
  searchLevel: 120,
  printingLevel: 220,
  miningLevel: 320,
  bargainPercent: 20,
  btcBuffPercent: 40,
};
const prices = resolveMarketPrices(defaultSharedUserInputs);

let perMinuteData: EarningsChartData;
let elapsedData: EarningsChartData;

function getResult(
  calculation: EarningsCalculation,
  id: EarningsActivityId,
): EarningsActivityResult {
  const result = calculation.activities.find((activity) => activity.id === id);
  if (!result) throw new Error(`缺少活動結果：${id}`);
  return result;
}

beforeAll(() => {
  perMinuteData = deriveEarningsChartData(inputs, prices, 'per-minute');
  elapsedData = deriveEarningsChartData(inputs, prices, 'elapsed-15');
});

describe('Earnings chart data', () => {
  it('預設變動收益並以兩組檢視涵蓋全部活動', () => {
    expect(defaultEarningsChartGroupId).toBe('variable');
    expect(earningsChartGroups.map((group) => group.id)).toEqual([
      'variable',
      'fixed',
    ]);
    expect(new Set(earningsChartGroups.flatMap((group) => group.activityIds))).toEqual(
      new Set([
        ...earningsActivityCatalog.map((activity) => activity.id),
        mixedCrushingChartActivityId,
      ]),
    );
    expect(earningsChartGroups.map((group) => group.activityIds.length)).toEqual([8, 10]);
    expect(defaultEarningsChartVisibleActivityIds).toEqual([
      'search',
      'mining',
      'black-market-trash',
      'yellow-box',
    ]);
  });

  it('產生 Lv.1–800 與全部 16 種活動系列', () => {
    expect(perMinuteData.points).toHaveLength(800);
    expect(perMinuteData.points[0]?.level).toBe(1);
    expect(perMinuteData.points.at(-1)?.level).toBe(800);
    expect(perMinuteData.activityIds).toEqual([
      ...earningsActivityCatalog.map((activity) => activity.id),
      mixedCrushingChartActivityId,
    ]);
    expect(perMinuteData.activityIds).toHaveLength(17);
  });

  it('每個 X 等級同時套用搜索、分子列印與挖礦等級', () => {
    const level = 500;
    const point = perMinuteData.points[level - 1]!;
    const expected = calculateEarnings(
      {
        ...inputs,
        searchLevel: level,
        printingLevel: level,
        miningLevel: level,
      },
      prices,
      { comparisonMode: 'per-minute' },
    )!;

    expect(point.values.search).toBe(getResult(expected, 'search').aiPerMinute);
    for (const activityId of [
      'black-market-trash',
      'black-market-common',
      'black-market-high-quality',
      'black-market-rare',
    ] as const) {
      expect(point.values[activityId]).not.toBeNull();
      expect(point.values[activityId]).toBe(getResult(expected, activityId).aiPerMinute);
    }
    expect(point.values.mining).toBe(getResult(expected, 'mining').aiPerMinute);
  });

  it('每分鐘與飛逝模式使用不同收益欄位', () => {
    const level = 300;
    const perMinutePoint = perMinuteData.points[level - 1]!;
    const elapsedPoint = elapsedData.points[level - 1]!;
    const elapsedExpected = calculateEarnings(
      {
        ...inputs,
        searchLevel: level,
        printingLevel: level,
        miningLevel: level,
      },
      prices,
      { comparisonMode: 'elapsed-15' },
    )!;

    expect(perMinutePoint.values.search).not.toBe(elapsedPoint.values.search);
    expect(elapsedPoint.values.search)
      .toBe(getResult(elapsedExpected, 'search').elapsed?.totalNetAi);
  });

  it('固定收益活動保持水平線，代表點資料可排序為十列', () => {
    for (const activityId of fixedEarningsChartActivityIds) {
      const values = perMinuteData.points.map((point) => point.values[activityId]);
      expect(new Set(values).size).toBe(1);
    }

    const rows = getFixedEarningsChartRows(perMinuteData);
    const calculation = calculateEarnings(inputs, prices, { comparisonMode: 'per-minute' })!;
    for (const activityId of fixedEarningsChartActivityIds.filter((id) => id.startsWith('pack-'))) {
      if (activityId === mixedCrushingChartActivityId) continue;
      expect(perMinuteData.points[0]?.values[activityId])
        .toBe(getResult(calculation, activityId).aiPerMinute);
    }
    expect(rows).toHaveLength(10);
    expect(rows.every((row, index) => index === 0 || (
      row.value === null
      || rows[index - 1]?.value === null
      || (rows[index - 1]?.value ?? Number.NEGATIVE_INFINITY) >= row.value
    ))).toBe(true);
  });

  it('固定混合壓碎列依比較模式顯示同一手動組合，且跨 800 等級保持不變', () => {
    const counts = { medical: 2, ammunition: 3, military: 4 };
    const perMinuteCalculation = calculateEarnings(inputs, prices, {
      comparisonMode: 'per-minute',
    })!;
    const perMinuteMixed = calculateManualMixedCrushing(perMinuteCalculation, counts)!;
    const perMinuteChart = deriveEarningsChartData(
      inputs,
      prices,
      'per-minute',
      perMinuteMixed,
    );

    expect(new Set(perMinuteChart.points.map((point) =>
      point.values[mixedCrushingChartActivityId])))
      .toEqual(new Set([perMinuteMixed.aiPerMinute]));
    expect(getFixedEarningsChartRows(perMinuteChart).find((row) =>
      row.activityId === mixedCrushingChartActivityId)?.value)
      .toBe(perMinuteMixed.aiPerMinute);

    const elapsedCalculation = calculateEarnings(inputs, prices, {
      comparisonMode: 'elapsed-105',
    })!;
    const elapsedMixed = calculateManualMixedCrushing(elapsedCalculation, counts)!;
    const elapsedChart = deriveEarningsChartData(
      inputs,
      prices,
      'elapsed-105',
      elapsedMixed,
    );
    expect(new Set(elapsedChart.points.map((point) =>
      point.values[mixedCrushingChartActivityId])))
      .toEqual(new Set([elapsedMixed.totalNetAi]));
    expect(elapsedChart.points[799]?.values[mixedCrushingChartActivityId])
      .toBe(elapsedMixed.totalNetAi);
  });

  it('AI 製作負值不擴大範圍，但其他活動負值仍參與計算', () => {
    const positiveData = makeChartData([{
      level: 1,
      values: { search: 10, 'ai-crafting': -100_000 } as EarningsChartPoint['values'],
    }]);
    expect(getEarningsChartYDomain(positiveData, ['search', 'ai-crafting']))
      .toEqual(getEarningsChartYDomain(positiveData, ['search']));
    expect(getEarningsChartYDomain(positiveData, ['search', 'ai-crafting']))
      .toEqual({ min: 0, max: 10.5 });
    expect(positiveData.points[0]?.values['ai-crafting']).toBe(-100_000);

    const negativeData = makeChartData([{
      level: 1,
      values: { search: -20, 'ai-crafting': -100_000 } as EarningsChartPoint['values'],
    }]);
    expect(getEarningsChartYDomain(negativeData, ['search', 'ai-crafting']))
      .toEqual({ min: -21, max: 0 });
  });

  it('AI 製作正值仍納入縱軸範圍', () => {
    const data = makeChartData([{
      level: 1,
      values: { search: 10, 'ai-crafting': 200 } as EarningsChartPoint['values'],
    }]);

    expect(getEarningsChartYDomain(data, ['ai-crafting']))
      .toEqual({ min: 0, max: 210 });
    expect(data.points[0]?.values['ai-crafting']).toBe(200);
  });

  it('只有 AI 製作負值時使用安全 fallback，極端負值不觸發 symlog', () => {
    const onlyNegativeAi = makeChartData([{
      level: 1,
      values: { 'ai-crafting': -1e100 } as EarningsChartPoint['values'],
    }]);
    expect(getEarningsChartYDomain(onlyNegativeAi, ['ai-crafting']))
      .toEqual({ min: 0, max: 1 });
    expect(getEarningsChartYScale(onlyNegativeAi, ['ai-crafting']))
      .toMatchObject({ mode: 'linear', domain: { min: 0, max: 1 } });

    const mixedData = makeChartData(Array.from({ length: 5 }, (_, index) => ({
      level: index + 1,
      values: {
        search: index + 1,
        'ai-crafting': -1e100 * (index + 1),
      } as EarningsChartPoint['values'],
    })));
    const withNegativeAi = getEarningsChartYScale(mixedData, ['search', 'ai-crafting']);
    const withoutAi = getEarningsChartYScale(mixedData, ['search']);
    expect(withNegativeAi).toEqual(withoutAi);
    expect(withNegativeAi.mode).toBe('linear');
  });

  it('預設物價下 AI 製作負值不改變原始點，所有比較模式維持線性', () => {
    for (const mode of [
      'per-minute', 'elapsed-15', 'elapsed-30', 'elapsed-45', 'elapsed-60', 'elapsed-105',
    ] as const) {
      const data = deriveEarningsChartData(inputs, prices, mode);
      const aiValues = data.points.map((point) => point.values['ai-crafting']);
      const scale = getEarningsChartYScale(
        data,
        [...defaultEarningsChartVisibleActivityIds, 'ai-crafting'],
      );

      expect(scale.mode, mode).toBe('linear');
      expect(scale.domain.min).toBeLessThanOrEqual(0);
      expect(scale.domain.max).toBeGreaterThanOrEqual(0);
      expect(getEarningsChartYScaleTicks(scale)).toHaveLength(5);
      expect(data.points.map((point) => point.values['ai-crafting'])).toEqual(aiValues);
    }
  });

  it('極端正 AI 製作收益仍參與 symlog 判斷', () => {
    const extremeData = makeChartData(Array.from({ length: 5 }, (_, index) => ({
      level: index + 1,
      values: {
        search: 1,
        'ai-crafting': index === 4 ? 1_000_000 : index + 1,
      } as EarningsChartPoint['values'],
    })));
    const regularScale = getEarningsChartYScale(extremeData, ['search']);
    const compressedScale = getEarningsChartYScale(extremeData, ['search', 'ai-crafting']);

    expect(regularScale.mode).toBe('linear');
    expect(compressedScale.mode).toBe('symlog');
    expect(compressedScale.domain.min).toBeLessThan(0);
    expect(compressedScale.domain.max).toBeGreaterThan(0);
    expect(getEarningsChartYScaleTicks(compressedScale)).toHaveLength(5);
    expect(getEarningsChartYScaleTicks(compressedScale)).toContain(0);
  });

  it('沒有可見系列時仍提供安全的零基準 domain', () => {
    expect(getEarningsChartYDomain(perMinuteData, [])).toEqual({ min: 0, max: 1 });
  });
});

function makeChartData(points: readonly EarningsChartPoint[]): EarningsChartData {
  return {
    comparisonMode: 'per-minute',
    activityIds: ['search', 'ai-crafting', 'yellow-box'],
    points,
    minLevel: points[0]?.level ?? 1,
    maxLevel: points.at(-1)?.level ?? 1,
  };
}

describe('Fixed earnings rows and line hover helpers', () => {
  it('依代表點由高至低排序，null 排在最後且保留正負值', () => {
    const data = makeChartData([{
      level: 1,
      values: {
        'white-box': 3,
        'yellow-box': null,
        'crush-medical': -4,
        'crush-ammunition': 9,
        'crush-military-ammunition': 0,
        'pack-old-pouch': 1,
        'pack-fanny-pack': 5,
        'pack-explorer-backpack': -2,
        'pack-employee-office-case': null,
        'crush-mixed': null,
      } as EarningsChartPoint['values'],
    }]);

    expect(getFixedEarningsChartRows(data)).toEqual([
      { activityId: 'crush-ammunition', value: 9 },
      { activityId: 'pack-fanny-pack', value: 5 },
      { activityId: 'white-box', value: 3 },
      { activityId: 'pack-old-pouch', value: 1 },
      { activityId: 'crush-military-ammunition', value: 0 },
      { activityId: 'pack-explorer-backpack', value: -2 },
      { activityId: 'crush-medical', value: -4 },
      { activityId: 'yellow-box', value: null },
      { activityId: 'crush-mixed', value: null },
      { activityId: 'pack-employee-office-case', value: null },
    ]);
  });

  it('只選擇距離內的最近曲線，忽略 null，距離相同時保留穩定順序', () => {
    const data = makeChartData([{
      level: 1,
      values: {
        search: 20,
        'yellow-box': null,
      } as EarningsChartPoint['values'],
    }]);

    const plotBounds = { minY: 0, maxY: 40 };
    expect(findNearestEarningsChartSeries(
      data,
      ['search', 'yellow-box'],
      0,
      21,
      (value) => value,
      plotBounds,
    )).toMatchObject({ activityId: 'search', value: 20, distance: 1 });
    expect(findNearestEarningsChartSeries(
      data,
      ['search', 'yellow-box'],
      0,
      40,
      (value) => value,
      plotBounds,
    )).toBeNull();
    expect(findNearestEarningsChartSeries(
      data,
      ['search', 'yellow-box'],
      0,
      41,
      (value) => value,
      plotBounds,
    )).toBeNull();

    const tieData = makeChartData([{
      level: 1,
      values: {
        search: 10,
        'yellow-box': 14,
      } as EarningsChartPoint['values'],
    }]);
    expect(findNearestEarningsChartSeries(
      tieData,
      ['search', 'yellow-box'],
      0,
      12,
      (value) => value,
      plotBounds,
    )?.activityId).toBe('search');
  });

  it('不對繪圖範圍外的 AI 負值線段觸發 hover', () => {
    const data = makeChartData([{
      level: 1,
      values: { 'ai-crafting': -10_000 } as EarningsChartPoint['values'],
    }]);

    expect(findNearestEarningsChartSeries(
      data,
      ['ai-crafting'],
      0,
      100,
      (value) => value,
      { minY: 0, maxY: 100 },
    )).toBeNull();
  });

  it('將 callout clamp 在左右與上下邊界內，右側不足時改放左側', () => {
    expect(getEarningsChartCalloutPosition({
      pointX: 280,
      pointY: 100,
      calloutWidth: 80,
      calloutHeight: 30,
      minX: 40,
      maxX: 300,
      minY: 20,
      maxY: 180,
    })).toEqual({ x: 192, y: 85, placement: 'left' });

    expect(getEarningsChartCalloutPosition({
      pointX: 40,
      pointY: 20,
      calloutWidth: 180,
      calloutHeight: 40,
      minX: 40,
      maxX: 200,
      minY: 20,
      maxY: 180,
    })).toEqual({ x: 40, y: 20, placement: 'left' });

    expect(getEarningsChartCalloutPosition({
      pointX: 160,
      pointY: 175,
      calloutWidth: 60,
      calloutHeight: 40,
      minX: 40,
      maxX: 240,
      minY: 20,
      maxY: 180,
    }).y).toBe(140);
  });
});
