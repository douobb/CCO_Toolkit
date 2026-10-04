import type { NumberFormatter } from './number-formatting';

export const chartMinimumWidth = 640;
export const chartDefaultWidth = 960;
export const chartCompactBreakpoint = 640;
export const chartYAxisTickLabelReserve = 36;
export const chartYAxisTickGap = 6;
export const chartTickEstimatedCharacterWidth = 6;

export interface ResponsiveChartVerticalInsets {
  readonly compactTop: number;
  readonly wideTop: number;
  readonly compactBottom?: number;
  readonly wideBottom?: number;
}

/**
 * 共用寬幅圖表尺寸：保留既有高度與垂直 inset，只縮減左右 gutter。
 */
export function getResponsiveChartDimensions(
  containerWidth: number,
  insets: ResponsiveChartVerticalInsets,
) {
  const measuredWidth = Math.round(containerWidth || chartDefaultWidth);
  const width = Math.max(chartMinimumWidth, measuredWidth);
  const compact = measuredWidth < chartCompactBreakpoint;

  return {
    width,
    height: Math.min(400, Math.max(180, Math.round(width / 2))),
    left: chartYAxisTickLabelReserve + chartYAxisTickGap + (compact ? 2 : 6),
    right: compact ? 8 : 12,
    top: compact ? insets.compactTop : insets.wideTop,
    bottom: compact ? insets.compactBottom ?? 44 : insets.wideBottom ?? 62,
  } as const;
}

/** 長數字使用 compact notation，讓負值刻度也能放入固定 Y 軸標籤保留區。 */
export function formatChartAxisTick(
  formatNumber: NumberFormatter,
  value: number,
) {
  const magnitude = Math.abs(value);
  const maximumFractionDigits = magnitude >= 100
    ? 0
    : magnitude >= 10
      ? 1
      : 2;

  return formatNumber(value, {
    notation: magnitude >= 1_000 ? 'compact' : 'standard',
    compactDisplay: 'short',
    maximumFractionDigits,
  });
}

export function estimateChartTickLabelWidth(label: string) {
  return label.length * chartTickEstimatedCharacterWidth;
}

/** 首尾 X 刻度向圖內對齊，避免縮小 right gutter 後文字被 viewBox 裁切。 */
export function getChartTickTextAnchor(
  index: number,
  tickCount: number,
): 'start' | 'middle' | 'end' {
  if (index === 0) return 'start';
  if (index === tickCount - 1) return 'end';
  return 'middle';
}
