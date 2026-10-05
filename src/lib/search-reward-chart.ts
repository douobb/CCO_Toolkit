import {
  calculateAreaReward,
  computeOptimalSearchArea,
  type SearchPrices,
  type SearchRewardEntry,
} from './search-reward-calculator';

/** 圖表支援的縱軸；收益與物品產量分開顯示，避免不同量級互相遮蔽。 */
export const searchRewardChartMetrics = ['quantity', 'value'] as const;
export type SearchRewardChartMetric = (typeof searchRewardChartMetrics)[number];

export interface SearchRewardChartPoint {
  /** 資料集中的實際搜索地區等級。 */
  readonly level: number;
  /** 圖表提示使用的地區等級；對搜索收益資料而言與 level 相同。 */
  readonly areaLevel: number;
  readonly expectedMtQty: number;
  readonly expectedAtpQty: number;
  readonly expectedMatpQty: number;
  readonly totalExpectedValue: number;
  /** 依資料順序，收益創下截至當時新高的收益階梯點。 */
  readonly isLadderPoint: boolean;
}

export interface SearchRewardChartData {
  /** 只包含資料集中的實際地區等級，不補齊不存在的等級。 */
  readonly points: readonly SearchRewardChartPoint[];
  readonly minLevel: number;
  readonly maxLevel: number;
}

export interface SearchRewardChartPlotYBounds {
  readonly minY: number;
  readonly maxY: number;
}

export interface SearchRewardChartSeriesValue<TSeriesId extends string = string> {
  readonly id: TSeriesId;
  readonly value: number;
}

export interface SearchRewardChartHoverTarget<TSeriesId extends string = string>
  extends SearchRewardChartSeriesValue<TSeriesId> {
  readonly distance: number;
}

export const searchRewardChartHoverDistanceThreshold = 12;

/** 在目前等級找距離游標最近且位於門檻內的曲線；同距離保留輸入順序。 */
export function findNearestSearchRewardChartSeries<TSeriesId extends string>(
  series: readonly SearchRewardChartSeriesValue<TSeriesId>[],
  pointerY: number,
  yForValue: (value: number) => number,
  plotBounds: SearchRewardChartPlotYBounds,
  maxDistance = searchRewardChartHoverDistanceThreshold,
): SearchRewardChartHoverTarget<TSeriesId> | null {
  if (
    !Number.isFinite(pointerY)
    || !Number.isFinite(maxDistance)
    || maxDistance < 0
    || !Number.isFinite(plotBounds.minY)
    || !Number.isFinite(plotBounds.maxY)
    || plotBounds.minY > plotBounds.maxY
    || pointerY < plotBounds.minY
    || pointerY > plotBounds.maxY
  ) return null;

  let nearest: SearchRewardChartHoverTarget<TSeriesId> | null = null;
  for (const item of series) {
    if (!Number.isFinite(item.value)) continue;
    const seriesY = yForValue(item.value);
    if (
      !Number.isFinite(seriesY)
      || seriesY < plotBounds.minY
      || seriesY > plotBounds.maxY
    ) continue;

    const distance = Math.abs(pointerY - seriesY);
    if (distance <= maxDistance && (nearest === null || distance < nearest.distance)) {
      nearest = { ...item, distance };
    }
  }

  return nearest;
}

export interface SearchRewardChartCalloutLayout {
  readonly width: number;
  readonly height: number;
  readonly labelLines: readonly string[];
  readonly valueLines: readonly string[];
}

function estimateCalloutTextWidth(text: string, fontSize: number) {
  return Array.from(text).reduce((width, character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const isWideCharacter = codePoint >= 0x2e80;
    const characterWidth = /\s/u.test(character)
      ? fontSize * 0.3
      : fontSize * (isWideCharacter ? 1 : 0.6);
    return width + characterWidth;
  }, 0);
}

function wrapCalloutText(text: string, maxWidth: number, fontSize: number) {
  const lines: string[] = [];
  let line = '';

  for (const character of Array.from(text)) {
    const candidate = line + character;
    if (line && estimateCalloutTextWidth(candidate, fontSize) > maxWidth) {
      lines.push(line.trimEnd());
      line = character.trimStart();
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line.trimEnd());
  return lines.length > 0 ? lines : [''];
}

/** 依可用 plot 寬度換行 callout，維持固定字級並容納多語長標籤。 */
export function getSearchRewardChartCalloutLayout(
  label: string,
  value: string,
  maxWidth: number,
): SearchRewardChartCalloutLayout {
  const safeMaxWidth = Number.isFinite(maxWidth) ? Math.max(1, maxWidth) : 1;
  const desiredWidth = Math.max(
    150,
    estimateCalloutTextWidth(label, 11),
    estimateCalloutTextWidth(value, 10),
  ) + 16;
  const width = Math.min(safeMaxWidth, desiredWidth);
  const textWidth = Math.max(1, width - 16);
  const labelLines = wrapCalloutText(label, textWidth, 11);
  const valueLines = wrapCalloutText(value, textWidth, 10);
  const height = 42 + (labelLines.length - 1) * 14 + (valueLines.length - 1) * 13;

  return { width, height, labelLines, valueLines };
}

export interface SearchRewardChartCalloutPositionInput {
  readonly pointX: number;
  readonly pointY: number;
  readonly calloutWidth: number;
  readonly calloutHeight: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly gap?: number;
}

export interface SearchRewardChartCalloutPosition {
  readonly x: number;
  readonly y: number;
  readonly placement: 'left' | 'right';
}

/** 將 hover callout 靠近曲線並限制在目前繪圖區域內。 */
export function getSearchRewardChartCalloutPosition({
  pointX,
  pointY,
  calloutWidth,
  calloutHeight,
  minX,
  maxX,
  minY,
  maxY,
  gap = 8,
}: SearchRewardChartCalloutPositionInput): SearchRewardChartCalloutPosition {
  const safeMinX = Math.min(minX, maxX);
  const safeMaxX = Math.max(minX, maxX);
  const safeMinY = Math.min(minY, maxY);
  const safeMaxY = Math.max(minY, maxY);
  const rightX = pointX + gap;
  const leftX = pointX - gap - calloutWidth;
  const canPlaceRight = rightX + calloutWidth <= safeMaxX;
  const canPlaceLeft = leftX >= safeMinX;
  const placement = canPlaceRight ? 'right' : 'left';
  const preferredX = canPlaceRight ? rightX : canPlaceLeft ? leftX : pointX - calloutWidth / 2;
  const maxCalloutX = Math.max(safeMinX, safeMaxX - calloutWidth);
  const maxCalloutY = Math.max(safeMinY, safeMaxY - calloutHeight);

  return {
    x: Math.max(safeMinX, Math.min(maxCalloutX, preferredX)),
    y: Math.max(safeMinY, Math.min(maxCalloutY, pointY - calloutHeight / 2)),
    placement,
  };
}

/**
 * 由正式 Search Reward 單一地區計算邏輯衍生圖表資料。
 *
 * 每個 X 點直接使用資料集該地區的 calculateAreaReward 結果；收益階梯點
 * 則沿用 computeOptimalSearchArea 的正式 ladder 定義，不重複任何收益公式。
 */
export function deriveSearchRewardChartData(
  rewards: readonly SearchRewardEntry[],
  prices: SearchPrices,
  searchCount: number,
): SearchRewardChartData {
  const sortedRewards = [...rewards].sort((a, b) => a.level - b.level);
  const calculatedRewards = sortedRewards.map((entry) => calculateAreaReward(entry, prices, searchCount));
  const ladderLevels = new Set(
    computeOptimalSearchArea(sortedRewards, null, prices, searchCount).ladder.map(
      (entry) => entry.level,
    ),
  );
  const points = calculatedRewards.map((reward) => ({
    ...reward,
    areaLevel: reward.level,
    isLadderPoint: ladderLevels.has(reward.level),
  }));

  return {
    points,
    minLevel: points[0]?.level ?? 0,
    maxLevel: points.at(-1)?.level ?? 0,
  };
}
