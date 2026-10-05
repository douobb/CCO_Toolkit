import { describe, expect, it } from 'vitest';

import { defaultSearchRewards } from './search-reward';
import { calculateAreaReward, type SearchRewardEntry } from './search-reward-calculator';
import {
  deriveSearchRewardChartData,
  findNearestSearchRewardChartSeries,
  getSearchRewardChartCalloutLayout,
  getSearchRewardChartCalloutPosition,
} from './search-reward-chart';

const chartPrices = { mt: 1_000, atp: 2_000, matp: 3_000 } as const;

const sampleRewards: readonly SearchRewardEntry[] = [
  { level: 1, mt: 1, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
  { level: 10, mt: 3, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
  { level: 20, mt: 2, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
  { level: 30, mt: 5, mt_p: 1, atp: 0, atp_p: 0, matp: 0, matp_p: 0 },
];

describe('Search Reward chart data', () => {
  it('每個點直接使用資料集地區的正式單一地區計算值', () => {
    const chart = deriveSearchRewardChartData(sampleRewards, chartPrices, 2);

    expect(chart.points).toHaveLength(sampleRewards.length);
    expect(chart.points[0]).toEqual({
      ...calculateAreaReward(sampleRewards[0]!, chartPrices, 2),
      areaLevel: 1,
      isLadderPoint: true,
    });
    expect(chart.points.map((point) => point.level)).toEqual([1, 10, 20, 30]);
  });

  it('只以收益嚴格創新高的實際地區等級標示收益階梯點', () => {
    const chart = deriveSearchRewardChartData(sampleRewards, chartPrices, 1);

    expect(chart.points.filter((point) => point.isLadderPoint).map((point) => point.level)).toEqual([
      1,
      10,
      30,
    ]);
  });

  it('保留非單調資料的下降，不改成截至等級的歷史最佳收益', () => {
    const chart = deriveSearchRewardChartData(sampleRewards, chartPrices, 1);

    expect(chart.points.map((point) => point.totalExpectedValue)).toEqual([1, 3, 2, 5]);
    expect(chart.points[2]?.isLadderPoint).toBe(false);
  });

  it('X 軸使用資料集實際最小／最大等級，不虛構尾段', () => {
    const chart = deriveSearchRewardChartData(defaultSearchRewards, { mt: 0, atp: 0, matp: 0 }, 1);

    expect(chart.points).toHaveLength(240);
    expect(chart.minLevel).toBe(1);
    expect(chart.maxLevel).toBe(797);
    expect(chart.points.at(-1)?.level).toBe(797);
    expect(chart.points.some((point) => point.level === 800)).toBe(false);
  });

  it('隨搜索次數與物價變化重新衍生每個資料點，且不改動輸入資料', () => {
    const rewards = [...sampleRewards];
    const oneSearch = deriveSearchRewardChartData(rewards, chartPrices, 1);
    const twoSearches = deriveSearchRewardChartData(rewards, chartPrices, 2);
    const higherPrice = deriveSearchRewardChartData(
      rewards,
      { mt: 2_000, atp: 2_000, matp: 3_000 },
      1,
    );

    expect(twoSearches.points[1]?.totalExpectedValue).toBe(
      (oneSearch.points[1]?.totalExpectedValue ?? 0) * 2,
    );
    expect(higherPrice.points[1]?.totalExpectedValue).toBe(
      (oneSearch.points[1]?.totalExpectedValue ?? 0) + 3,
    );
    expect(rewards.map((entry) => entry.level)).toEqual([1, 10, 20, 30]);
  });
});

describe('Search Reward chart hover helpers', () => {
  it('只命中距離門檻內最近的曲線，同距離時保留 series 順序', () => {
    const series = [
      { id: 'medical', value: 10 },
      { id: 'ammo', value: 14 },
      { id: 'military', value: 50 },
    ] as const;

    expect(findNearestSearchRewardChartSeries(
      series,
      12,
      (value) => value,
      { minY: 0, maxY: 40 },
    )).toEqual({ id: 'medical', value: 10, distance: 2 });
    expect(findNearestSearchRewardChartSeries(
      series,
      30,
      (value) => value,
      { minY: 0, maxY: 60 },
    )).toBeNull();
    expect(findNearestSearchRewardChartSeries(
      series,
      61,
      (value) => value,
      { minY: 0, maxY: 60 },
    )).toBeNull();
  });

  it('窄繪圖區換行長標籤與數值，維持固定字級所需高度', () => {
    const layout = getSearchRewardChartCalloutLayout(
      'Military ammunition tech parts (MATP)',
      '123456789012345678901234567890 AI / batch',
      170,
    );

    expect(layout.width).toBe(170);
    expect(layout.labelLines.length).toBeGreaterThan(1);
    expect(layout.valueLines.length).toBeGreaterThan(1);
    expect(layout.height).toBeGreaterThan(42);
  });

  it('callout 靠右側空間不足時改靠左並限制於繪圖範圍', () => {
    const position = getSearchRewardChartCalloutPosition({
      pointX: 290,
      pointY: 175,
      calloutWidth: 100,
      calloutHeight: 60,
      minX: 40,
      maxX: 300,
      minY: 20,
      maxY: 180,
    });

    expect(position.placement).toBe('left');
    expect(position.x).toBeGreaterThanOrEqual(40);
    expect(position.x + 100).toBeLessThanOrEqual(300);
    expect(position.y).toBeGreaterThanOrEqual(20);
    expect(position.y + 60).toBeLessThanOrEqual(180);
  });
});
