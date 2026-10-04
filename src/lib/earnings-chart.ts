import {
  earningsActivityIds,
  type EarningsActivityId,
} from '@/data/game/earnings-activities';
import {
  calculateEarnings,
  EARNINGS_LEVEL_MAX,
  EARNINGS_LEVEL_MIN,
  type EarningsActivityResult,
  type EarningsComparisonMode,
  type EarningsInputs,
} from './earnings-calculator';
import type { ResolvedMarketPrices } from './market-prices';

export const fixedEarningsChartActivityIds = [
  'white-box',
  'yellow-box',
  'crush-medical',
  'crush-ammunition',
  'crush-military-ammunition',
  'pack-old-pouch',
  'pack-fanny-pack',
  'pack-explorer-backpack',
  'pack-employee-office-case',
] as const satisfies readonly EarningsActivityId[];

/** 變動收益圖表中的所有系列；yellow-box 是不可關閉的固定參考線。 */
export const variableEarningsChartActivityIds = [
  'search',
  'mining',
  'black-market-trash',
  'black-market-common',
  'black-market-high-quality',
  'black-market-rare',
  'ai-crafting',
  'yellow-box',
] as const satisfies readonly EarningsActivityId[];

/** 變動收益中可由圖例切換的系列。 */
export const selectableVariableEarningsChartActivityIds = variableEarningsChartActivityIds.filter(
  (activityId) => activityId !== 'yellow-box',
);

/** 變動收益圖表的預設可見系列；yellow-box 永遠作為參考線保留。 */
export const defaultEarningsChartVisibleActivityIds = [
  'search',
  'mining',
  'black-market-trash',
  'yellow-box',
] as const satisfies readonly EarningsActivityId[];

export const earningsChartGroups = [
  {
    id: 'variable',
    activityIds: variableEarningsChartActivityIds,
  },
  { id: 'fixed', activityIds: fixedEarningsChartActivityIds },
] as const satisfies readonly {
  readonly id: string;
  readonly activityIds: readonly EarningsActivityId[];
}[];

export type EarningsChartGroupId = (typeof earningsChartGroups)[number]['id'];

export const defaultEarningsChartGroupId = 'variable' satisfies EarningsChartGroupId;
export const defaultEarningsChartActivityIds = defaultEarningsChartVisibleActivityIds;

export function isEarningsChartGroupId(value: unknown): value is EarningsChartGroupId {
  return earningsChartGroups.some((group) => group.id === value);
}

export function getEarningsChartGroup(groupId: EarningsChartGroupId) {
  return earningsChartGroups.find((group) => group.id === groupId)!;
}

export type EarningsChartActivityValues = Readonly<
  Record<EarningsActivityId, number | null>
>;

export interface EarningsChartPoint {
  readonly level: number;
  readonly values: EarningsChartActivityValues;
}

export interface EarningsChartData {
  readonly comparisonMode: EarningsComparisonMode;
  readonly activityIds: readonly EarningsActivityId[];
  readonly points: readonly EarningsChartPoint[];
  readonly minLevel: number;
  readonly maxLevel: number;
}

export interface FixedEarningsChartRow {
  readonly activityId: EarningsActivityId;
  readonly value: number | null;
}

/** 固定收益活動採用 chartData 的第一個點作代表值；其值應跨共同等級保持固定。 */
export function getFixedEarningsChartRows(
  data: EarningsChartData,
): readonly FixedEarningsChartRow[] {
  const representativePoint = data.points[0];

  return fixedEarningsChartActivityIds
    .map((activityId, order): FixedEarningsChartRow & { readonly order: number } => ({
      activityId,
      value: isUsableChartValue(representativePoint?.values[activityId])
        ? representativePoint.values[activityId]
        : null,
      order,
    }))
    .sort((left, right) => {
      if (left.value === null && right.value === null) return left.order - right.order;
      if (left.value === null) return 1;
      if (right.value === null) return -1;
      return right.value - left.value || left.order - right.order;
    })
    .map(({ activityId, value }) => ({ activityId, value }));
}

export const earningsChartHoverDistanceThreshold = 12;

export interface EarningsChartHoverTarget {
  readonly activityId: EarningsActivityId;
  readonly value: number;
  readonly distance: number;
}

export interface EarningsChartPlotYBounds {
  readonly minY: number;
  readonly maxY: number;
}

/** 在目前 X 等級找距離游標 Y 最近、且位於門檻內的可見曲線；同距離時保留輸入順序。 */
export function findNearestEarningsChartSeries(
  data: EarningsChartData,
  visibleActivityIds: readonly EarningsActivityId[],
  pointIndex: number,
  pointerY: number,
  yForValue: (value: number) => number,
  plotBounds: EarningsChartPlotYBounds,
  maxDistance = earningsChartHoverDistanceThreshold,
): EarningsChartHoverTarget | null {
  const point = data.points[pointIndex];
  if (
    !point
    || !Number.isFinite(pointerY)
    || !Number.isFinite(maxDistance)
    || maxDistance < 0
    || !Number.isFinite(plotBounds.minY)
    || !Number.isFinite(plotBounds.maxY)
    || plotBounds.minY > plotBounds.maxY
    || pointerY < plotBounds.minY
    || pointerY > plotBounds.maxY
  ) {
    return null;
  }

  let nearest: EarningsChartHoverTarget | null = null;
  for (const activityId of visibleActivityIds) {
    const value = point.values[activityId];
    if (!isUsableChartValue(value)) continue;

    const seriesY = yForValue(value);
    if (
      !Number.isFinite(seriesY)
      || seriesY < plotBounds.minY
      || seriesY > plotBounds.maxY
    ) continue;
    const distance = Math.abs(seriesY - pointerY);
    if (distance > maxDistance) continue;
    if (!nearest || distance < nearest.distance) {
      nearest = { activityId, value, distance };
    }
  }

  return nearest;
}

export interface EarningsChartCalloutPositionInput {
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

export interface EarningsChartCalloutPosition {
  readonly x: number;
  readonly y: number;
  readonly placement: 'left' | 'right';
}

/** 將 hover callout 放在資料點旁，並限制在指定 plot/viewBox 範圍內。 */
export function getEarningsChartCalloutPosition({
  pointX,
  pointY,
  calloutWidth,
  calloutHeight,
  minX,
  maxX,
  minY,
  maxY,
  gap = 8,
}: EarningsChartCalloutPositionInput): EarningsChartCalloutPosition {
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

function isUsableChartValue(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export interface EarningsChartYDomain {
  readonly min: number;
  readonly max: number;
}

export interface EarningsChartYScale {
  readonly mode: 'linear' | 'symlog';
  readonly domain: EarningsChartYDomain;
  readonly constant: number;
}

export const earningsChartSymlogRatioThreshold = 100;
export const earningsChartSymlogConstant = 1;

function getVisibleChartValues(
  data: EarningsChartData,
  visibleActivityIds: readonly EarningsActivityId[],
) {
  return data.points.flatMap((point) => visibleActivityIds.flatMap((activityId) => {
    const value = point.values[activityId];
    return value !== null
      && Number.isFinite(value)
      && (activityId !== 'ai-crafting' || value >= 0)
      ? [value]
      : [];
  }));
}

function symlog(value: number, constant: number) {
  return Math.sign(value) * Math.log1p(Math.abs(value) / constant);
}

function symexp(value: number, constant: number) {
  return Math.sign(value) * Math.expm1(Math.abs(value)) * constant;
}

function getActivityValue(
  activity: EarningsActivityResult,
  comparisonMode: EarningsComparisonMode,
): number | null {
  return comparisonMode === 'per-minute'
    ? activity.aiPerMinute
    : activity.elapsed?.totalNetAi ?? null;
}

/**
 * 將同一 X 等級同時套用到搜索、分子列印與挖礦，再沿用其餘工具輸入與物價。
 */
export function deriveEarningsChartData(
  inputs: EarningsInputs,
  prices: ResolvedMarketPrices,
  comparisonMode: EarningsComparisonMode,
): EarningsChartData {
  const activityIds = earningsActivityIds;
  const points = Array.from(
    { length: EARNINGS_LEVEL_MAX - EARNINGS_LEVEL_MIN + 1 },
    (_, index): EarningsChartPoint => {
      const level = EARNINGS_LEVEL_MIN + index;
      const calculation = calculateEarnings(
        {
          ...inputs,
          searchLevel: level,
          printingLevel: level,
          miningLevel: level,
        },
        prices,
        { comparisonMode },
      );
      const activityById = new Map(
        calculation?.activities.map((activity) => [activity.id, activity]) ?? [],
      );
      const values = Object.fromEntries(
        activityIds.map((id) => {
          const activity = activityById.get(id);
          return [id, activity ? getActivityValue(activity, comparisonMode) : null];
        }),
      ) as Record<EarningsActivityId, number | null>;

      return { level, values };
    },
  );

  return {
    comparisonMode,
    activityIds,
    points,
    minLevel: EARNINGS_LEVEL_MIN,
    maxLevel: EARNINGS_LEVEL_MAX,
  };
}

/** 依目前可見系列計算 Y 軸，永遠保留零基準並為資料留少量邊界。 */
export function getEarningsChartYDomain(
  data: EarningsChartData,
  visibleActivityIds: readonly EarningsActivityId[],
): EarningsChartYDomain {
  const values = getVisibleChartValues(data, visibleActivityIds);

  if (values.length === 0) return { min: 0, max: 1 };

  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  if (rawMin === 0 && rawMax === 0) return { min: 0, max: 1 };

  if (rawMin < 0 && rawMax > 0) {
    const extent = Math.max(Math.abs(rawMin), Math.abs(rawMax)) * 1.05;
    return { min: -extent, max: extent };
  }

  if (rawMin < 0) return { min: rawMin * 1.05, max: 0 };
  return { min: 0, max: rawMax * 1.05 };
}

/**
 * 當可見收益的最大絕對值遠大於典型值時，改用可保留正負與零點的 symlog。
 * 預設物價使用線性刻度；保留此機制處理極端自訂物價造成的收益跨度。
 */
export function getEarningsChartYScale(
  data: EarningsChartData,
  visibleActivityIds: readonly EarningsActivityId[],
): EarningsChartYScale {
  const values = getVisibleChartValues(data, visibleActivityIds);
  if (values.length === 0) {
    return {
      mode: 'linear',
      domain: { min: 0, max: 1 },
      constant: earningsChartSymlogConstant,
    };
  }

  const absoluteValues = values
    .map((value) => Math.abs(value))
    .filter((value) => value > 0)
    .sort((left, right) => left - right);
  const maxAbsoluteValue = absoluteValues.at(-1) ?? 0;
  const medianAbsoluteValue = absoluteValues[Math.floor((absoluteValues.length - 1) / 2)] ?? 0;
  const shouldCompress = medianAbsoluteValue > 0
    && maxAbsoluteValue / Math.max(earningsChartSymlogConstant, medianAbsoluteValue)
      >= earningsChartSymlogRatioThreshold;

  if (!shouldCompress) {
    return {
      mode: 'linear',
      domain: getEarningsChartYDomain(data, visibleActivityIds),
      constant: earningsChartSymlogConstant,
    };
  }

  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const transformedMin = symlog(rawMin, earningsChartSymlogConstant);
  const transformedMax = symlog(rawMax, earningsChartSymlogConstant);
  const transformedRange = Math.max(1e-9, transformedMax - transformedMin);
  const padding = transformedRange * 0.05;

  return {
    mode: 'symlog',
    domain: {
      min: symexp(transformedMin - padding, earningsChartSymlogConstant),
      max: symexp(transformedMax + padding, earningsChartSymlogConstant),
    },
    constant: earningsChartSymlogConstant,
  };
}

export function transformEarningsChartYValue(
  value: number,
  scale: EarningsChartYScale,
) {
  return scale.mode === 'symlog' ? symlog(value, scale.constant) : value;
}

export function getEarningsChartYScaleTicks(
  scale: EarningsChartYScale,
): readonly number[] {
  if (scale.mode === 'linear') return getEarningsChartYTicks(scale.domain);

  const transformedMin = transformEarningsChartYValue(scale.domain.min, scale);
  const transformedMax = transformEarningsChartYValue(scale.domain.max, scale);
  if (transformedMin < 0 && transformedMax > 0) {
    return [
      scale.domain.min,
      symexp(transformedMin / 2, scale.constant),
      0,
      symexp(transformedMax / 2, scale.constant),
      scale.domain.max,
    ];
  }

  return Array.from({ length: 5 }, (_, index) =>
    symexp(
      transformedMin + (transformedMax - transformedMin) * index / 4,
      scale.constant,
    ),
  );
}

/** 產生固定五個線性 Y 軸刻度；跨越正負時零會位於中央。 */
export function getEarningsChartYTicks(
  domain: EarningsChartYDomain,
): readonly number[] {
  return Array.from({ length: 5 }, (_, index) => {
    const value = domain.min + (domain.max - domain.min) * index / 4;
    return Math.abs(value) < 1e-10 ? 0 : value;
  });
}
