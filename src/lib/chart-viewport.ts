export interface ChartLevelDomain {
  readonly min: number;
  readonly max: number;
}

export interface ChartViewport extends ChartLevelDomain {}

export type ChartViewportZoomDirection = 'in' | 'out';

export const chartViewportZoomFactor = 1.5;
export const chartViewportTickCount = 5;
export const chartViewportMinimumSpan = 4;
export const chartViewportMinimumSpanRatio = 1 / 64;
export const chartViewportSliderMax = 1000;

function getDomainBounds(domain: ChartLevelDomain) {
  return {
    min: Math.min(domain.min, domain.max),
    max: Math.max(domain.min, domain.max),
  };
}

function getMinimumViewportSpan(domainSpan: number) {
  return Math.min(
    domainSpan,
    Math.max(chartViewportMinimumSpan, domainSpan * chartViewportMinimumSpanRatio),
  );
}

export function canZoomChartViewportIn(
  viewport: ChartViewport,
  domain: ChartLevelDomain,
) {
  const domainSpan = Math.abs(domain.max - domain.min);
  return domainSpan > 0
    && viewport.max - viewport.min > getMinimumViewportSpan(domainSpan) + 1e-9;
}

export function isChartViewportFull(
  viewport: ChartViewport,
  domain: ChartLevelDomain,
) {
  const bounds = getDomainBounds(domain);
  const epsilon = Math.max(1, bounds.max - bounds.min) * 1e-9;
  return Math.abs(viewport.min - bounds.min) <= epsilon
    && Math.abs(viewport.max - bounds.max) <= epsilon;
}

export function zoomChartViewport(
  viewport: ChartViewport,
  domain: ChartLevelDomain,
  direction: ChartViewportZoomDirection,
): ChartViewport {
  const bounds = getDomainBounds(domain);
  const domainSpan = bounds.max - bounds.min;
  if (domainSpan <= 0) return bounds;

  const minimumSpan = getMinimumViewportSpan(domainSpan);
  const rawSpan = viewport.max - viewport.min;
  const currentSpan = rawSpan > 0 ? Math.min(domainSpan, rawSpan) : domainSpan;
  const nextSpan = direction === 'in'
    ? Math.max(minimumSpan, currentSpan / chartViewportZoomFactor)
    : Math.min(domainSpan, currentSpan * chartViewportZoomFactor);
  const center = (viewport.min + viewport.max) / 2;
  const min = Math.max(bounds.min, Math.min(bounds.max - nextSpan, center - nextSpan / 2));

  return { min, max: min + nextSpan };
}

/** 取得水平位置 slider 的整數值，讓原生 range 可用鍵盤操作。 */
export function getChartViewportSliderValue(
  viewport: ChartViewport,
  domain: ChartLevelDomain,
): number {
  const bounds = getDomainBounds(domain);
  const domainSpan = bounds.max - bounds.min;
  const viewportSpan = Math.min(domainSpan, Math.max(0, viewport.max - viewport.min));
  const availableDistance = domainSpan - viewportSpan;
  if (availableDistance <= 0) return 0;

  const min = Math.max(bounds.min, Math.min(bounds.max - viewportSpan, viewport.min));
  return Math.round((min - bounds.min) / availableDistance * chartViewportSliderMax);
}

/** 依 slider 位置平移視窗，保留跨度並限制於完整 domain。 */
export function setChartViewportSliderValue(
  viewport: ChartViewport,
  domain: ChartLevelDomain,
  sliderValue: number,
): ChartViewport {
  const bounds = getDomainBounds(domain);
  const domainSpan = bounds.max - bounds.min;
  if (domainSpan <= 0) return bounds;
  if (!Number.isFinite(sliderValue)) return viewport;

  const viewportSpan = Math.min(domainSpan, Math.max(0, viewport.max - viewport.min));
  const availableDistance = domainSpan - viewportSpan;
  if (availableDistance <= 0) return bounds;

  const ratio = Math.max(0, Math.min(1, sliderValue / chartViewportSliderMax));
  if (ratio === 0) return { min: bounds.min, max: bounds.min + viewportSpan };
  if (ratio === 1) return { min: bounds.max - viewportSpan, max: bounds.max };

  const min = bounds.min + availableDistance * ratio;
  return { min, max: min + viewportSpan };
}

/** 最小幅度平移視窗，確保指定等級可見，同時保留跨度並限制於完整 domain。 */
export function ensureChartViewportLevelVisible(
  viewport: ChartViewport,
  domain: ChartLevelDomain,
  level: number,
): ChartViewport {
  const bounds = getDomainBounds(domain);
  const domainSpan = bounds.max - bounds.min;
  if (domainSpan <= 0) return bounds;

  const span = Math.min(domainSpan, Math.max(0, viewport.max - viewport.min));
  const maxMin = bounds.max - span;
  const currentMin = Math.max(bounds.min, Math.min(maxMin, viewport.min));
  const currentMax = currentMin + span;
  const target = Math.max(bounds.min, Math.min(bounds.max, level));

  if (target >= currentMin && target <= currentMax) {
    return currentMin === viewport.min && currentMax === viewport.max
      ? viewport
      : { min: currentMin, max: currentMax };
  }

  const min = target < currentMin
    ? Math.max(bounds.min, target)
    : Math.min(maxMin, target - span);
  return { min, max: min + span };
}

/** 固定回傳五個刻度，避免縮放時因去重而忽然減少座標刻度。 */
export function getChartViewportTicks(
  viewport: ChartViewport,
  count = chartViewportTickCount,
): readonly number[] {
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount === 1) return [viewport.min];

  return Array.from({ length: safeCount }, (_, index) =>
    viewport.min + (viewport.max - viewport.min) * index / (safeCount - 1),
  );
}
