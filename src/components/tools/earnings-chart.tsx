'use client';

import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Tabs } from '@base-ui/react/tabs';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  chartDefaultWidth,
  chartYAxisTickGap,
  formatChartAxisTick,
  getChartTickTextAnchor,
  getResponsiveChartDimensions,
} from '@/lib/chart-layout';
import {
  getChartSelectionIndex,
  hasChartTouchGestureMoved,
  initialChartSelectionState,
  reduceChartSelection,
} from '@/lib/chart-selection';
import { getChartViewportTicks } from '@/lib/chart-viewport';
import {
  earningsActivityCatalog,
  type EarningsActivityId,
} from '@/data/game/earnings-activities';
import {
  defaultEarningsChartVisibleActivityIds,
  defaultEarningsChartGroupId,
  deriveEarningsChartData,
  earningsChartGroups,
  getEarningsChartCalloutPosition,
  getFixedEarningsChartRows,
  findNearestEarningsChartSeries,
  getEarningsChartGroup,
  getEarningsChartYScale,
  getEarningsChartYScaleTicks,
  isEarningsChartGroupId,
  selectableVariableEarningsChartActivityIds,
  transformEarningsChartYValue,
  variableEarningsChartActivityIds,
  type EarningsChartData,
  type EarningsChartGroupId,
  type EarningsChartHoverTarget,
  type EarningsChartPoint,
} from '@/lib/earnings-chart';
import type {
  EarningsComparisonMode,
  EarningsInputs,
} from '@/lib/earnings-calculator';
import type { Locale } from '@/lib/i18n';
import type { ResolvedMarketPrices } from '@/lib/market-prices';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import { getMessages } from '@/lib/translations';

import type { EarningsOverviewToolLabels } from './earnings-overview';
import { ChartViewportControls, useChartViewport } from './chart-viewport';

interface EarningsChartSeriesStyle {
  readonly color: string;
  readonly dashArray?: string;
}

const seriesStylePalette: readonly EarningsChartSeriesStyle[] = [
  { color: 'var(--cco-color-info)' },
  { color: 'var(--cco-color-warning)' },
  { color: 'var(--cco-color-success)' },
  { color: 'var(--cco-color-error)' },
  { color: 'var(--color-fd-primary)' },
  { color: 'var(--color-fd-foreground)' },
  { color: 'var(--cco-color-info)', dashArray: '9 5' },
  { color: 'var(--cco-color-warning)', dashArray: '9 5' },
  { color: 'var(--cco-color-success)', dashArray: '9 5' },
  { color: 'var(--cco-color-error)', dashArray: '9 5' },
  { color: 'var(--color-fd-primary)', dashArray: '9 5' },
  { color: 'var(--color-fd-foreground)', dashArray: '9 5' },
  { color: 'var(--cco-color-info)', dashArray: '2 5' },
  { color: 'var(--cco-color-warning)', dashArray: '2 5' },
  { color: 'var(--cco-color-success)', dashArray: '2 5' },
  { color: 'var(--cco-color-error)', dashArray: '2 5' },
];

const seriesStyleById = new Map(
  earningsActivityCatalog.map((activity, index) => [
    activity.id,
    seriesStylePalette[index % seriesStylePalette.length]!,
  ]),
);

// Header 與每一列共用相同的值欄寬，讓 0 標題與基準線保持垂直對齊。
const fixedEarningsGridColumns =
  'grid-cols-[minmax(5.5rem,34%)_minmax(0,1fr)_minmax(6rem,9rem)]';

export function getEarningsChartDimensions(containerWidth: number) {
  return getResponsiveChartDimensions(containerWidth, {
    compactTop: 28,
    wideTop: 32,
  });
}

function formatTemplate(
  template: string,
  replacements: Record<string, string | number>,
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace(`\${${key}}`, String(value)),
    template,
  );
}

function getLevelTicks(min: number, max: number): readonly number[] {
  return getChartViewportTicks({ min, max }).map(Math.round);
}

function getLinePath(
  data: EarningsChartData,
  activityId: EarningsActivityId,
  xForLevel: (level: number) => number,
  yForValue: (value: number) => number,
) {
  let segmentStarted = false;

  return data.points.flatMap((point) => {
    const value = point.values[activityId];
    if (value === null) {
      segmentStarted = false;
      return [];
    }

    const command = segmentStarted ? 'L' : 'M';
    segmentStarted = true;
    return `${command} ${xForLevel(point.level)} ${yForValue(value)}`;
  }).join(' ');
}

function getPointFromClientX(
  clientX: number,
  svg: SVGSVGElement | null,
  data: EarningsChartData,
  chartWidth: number,
  left: number,
  plotWidth: number,
  viewport: { readonly min: number; readonly max: number },
) {
  const bounds = svg?.getBoundingClientRect();
  if (!bounds || data.points.length === 0) return null;

  const viewBoxX = ((clientX - bounds.left) / Math.max(1, bounds.width)) * chartWidth;
  const ratio = Math.max(0, Math.min(1, (viewBoxX - left) / plotWidth));
  const level = viewport.min + ratio * (viewport.max - viewport.min);
  return Math.max(0, Math.min(data.points.length - 1, Math.round(level - data.minLevel)));
}

function isClientPointInChartPlot(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  chartWidth: number,
  chartHeight: number,
  left: number,
  top: number,
  plotWidth: number,
  plotHeight: number,
) {
  const bounds = svg.getBoundingClientRect();
  const x = (clientX - bounds.left) / Math.max(1, bounds.width) * chartWidth;
  const y = (clientY - bounds.top) / Math.max(1, bounds.height) * chartHeight;
  return x >= left
    && x <= left + plotWidth
    && y >= top
    && y <= top + plotHeight;
}

function getViewBoxYFromClientY(
  clientY: number,
  svg: SVGSVGElement | null,
  chartHeight: number,
) {
  const bounds = svg?.getBoundingClientRect();
  if (!bounds) return null;
  return ((clientY - bounds.top) / Math.max(1, bounds.height)) * chartHeight;
}

function getActivityLabel(id: EarningsActivityId, locale: Locale) {
  return earningsActivityCatalog.find((activity) => activity.id === id)?.labels[locale] ?? id;
}

function getGroupLabel(groupId: EarningsChartGroupId, labels: EarningsOverviewToolLabels) {
  const groupLabels: Record<EarningsChartGroupId, string> = {
    variable: labels.trendGroupVariable,
    fixed: labels.trendGroupFixed,
  };
  return groupLabels[groupId];
}

function formatChartValue(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

function EarningsChartDetails({
  point,
  visibleActivityIds,
  labels,
  locale,
  formatNumber,
}: {
  readonly point: EarningsChartPoint;
  readonly visibleActivityIds: readonly EarningsActivityId[];
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly formatNumber: NumberFormatter;
}) {
  return (
    <div
      className="@container mt-5 rounded-md border border-primary/40 bg-primary/5 p-4"
      data-earnings-chart-details="true"
      aria-live="polite"
    >
      <h3 className="font-semibold text-foreground">
        {formatTemplate(labels.trendSelectedLevel, { level: point.level })}
      </h3>
      <dl className="mt-3 grid gap-x-5 gap-y-2 border-t border-border pt-3 text-sm @min-[28rem]:grid-cols-2 @min-[48rem]:grid-cols-3">
        {visibleActivityIds.map((id) => {
          const value = point.values[id];
          return (
            <div key={id}>
              <dt className="text-muted-foreground">{getActivityLabel(id, locale)}</dt>
              <dd className={value !== null && value < 0
                ? 'font-semibold text-destructive'
                : 'font-semibold text-foreground'}
              >
                {value === null
                  ? labels.notAvailable
                  : `${formatChartValue(formatNumber, value)} ${labels.aiUnit}`}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function EarningsFixedBarChart({
  data,
  labels,
  locale,
  formatNumber,
}: {
  readonly data: EarningsChartData;
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly formatNumber: NumberFormatter;
}) {
  const rows = getFixedEarningsChartRows(data);
  const maxAbsValue = Math.max(
    1,
    ...rows.flatMap(({ value }) => value === null ? [] : [Math.abs(value)]),
  );

  return (
    <div
      className="mt-5 w-full space-y-2"
      data-earnings-chart-fixed="true"
      data-earnings-chart-fixed-row-count={rows.length}
      aria-label={labels.trendFixedHint}
    >
      <div
        className={`grid min-h-7 items-center ${fixedEarningsGridColumns} gap-2 text-xs text-muted-foreground sm:gap-3`}
        data-earnings-chart-fixed-grid="true"
      >
        <span />
        <span className="h-6 text-center leading-6" data-earnings-chart-fixed-zero-label="true">0</span>
        <span className="sr-only">{labels.aiUnit}</span>
      </div>
      {rows.map(({ activityId, value }) => {
        const activityLabel = getActivityLabel(activityId, locale);
        const barWidth = value === null
          ? 0
          : Math.min(50, Math.abs(value) / maxAbsValue * 50);
        const valueLabel = value === null
          ? labels.notAvailable
          : `${formatChartValue(formatNumber, value)} ${labels.aiUnit}`;

        return (
          <div
            key={activityId}
            className={`grid min-h-7 items-center ${fixedEarningsGridColumns} gap-2 text-xs sm:gap-3 sm:text-sm`}
            data-earnings-chart-fixed-row="true"
            data-earnings-chart-fixed-activity={activityId}
            data-earnings-chart-fixed-grid="true"
          >
            <span className="min-w-0 break-words leading-4 text-foreground">{activityLabel}</span>
            <div className="relative h-6 min-w-0 rounded-sm bg-muted/30">
              <span
                className="absolute inset-y-0 left-1/2 w-px bg-foreground/50"
                data-earnings-chart-fixed-zero-axis="true"
                aria-hidden="true"
              />
              {value === null ? null : (
                <span
                  className={`absolute inset-y-1 rounded-sm ${value < 0
                    ? 'right-1/2 bg-destructive/75'
                    : 'left-1/2 bg-[var(--cco-color-success)]/75'}`}
                  style={{ width: `${barWidth}%` }}
                  data-earnings-chart-fixed-bar={activityId}
                  data-earnings-chart-fixed-bar-sign={value < 0 ? 'negative' : 'positive'}
                  aria-hidden="true"
                />
              )}
            </div>
            <span
              className={`min-w-0 break-words text-right font-medium ${value !== null && value < 0
                ? 'text-destructive'
                : 'text-foreground'}`}
              data-earnings-chart-fixed-value={activityId}
            >
              {valueLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EarningsChartSvg({
  data,
  visibleActivityIds,
  activePointIndex,
  hoveredSeries,
  labels,
  locale,
  formatNumber,
  onHoverPoint,
  onHoverSeries,
  onKeyboardPoint,
  onSelectPoint,
  onClearSelection,
}: {
  readonly data: EarningsChartData;
  readonly visibleActivityIds: readonly EarningsActivityId[];
  readonly activePointIndex: number;
  readonly hoveredSeries: EarningsChartHoverTarget | null;
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly formatNumber: NumberFormatter;
  readonly onHoverPoint: (index: number | null) => void;
  readonly onHoverSeries: (target: EarningsChartHoverTarget | null) => void;
  readonly onKeyboardPoint: (index: number | null) => void;
  readonly onSelectPoint: (index: number) => void;
  readonly onClearSelection: () => void;
}) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const plotClipPathId = `earnings-chart-plot-${useId()}`;
  const touchGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressTouchClickRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(chartDefaultWidth);
  const chartDimensions = getEarningsChartDimensions(containerWidth);
  const plotWidth = chartDimensions.width - chartDimensions.left - chartDimensions.right;
  const plotHeight = chartDimensions.height - chartDimensions.top - chartDimensions.bottom;
  const chartDomain = { min: data.minLevel, max: data.maxLevel };
  const viewportControls = useChartViewport(chartDomain);
  const visibleMinLevel = viewportControls.viewport.min;
  const visibleMaxLevel = viewportControls.viewport.max;
  const levelRange = Math.max(1, visibleMaxLevel - visibleMinLevel);
  const yScale = useMemo(
    () => getEarningsChartYScale(data, visibleActivityIds),
    [data, visibleActivityIds],
  );
  const yDomain = yScale.domain;
  const levelTicks = getLevelTicks(visibleMinLevel, visibleMaxLevel);
  const valueTicks = getEarningsChartYScaleTicks(yScale);
  const activePoint = data.points[activePointIndex]!;
  const xForLevel = (level: number) =>
    chartDimensions.left + (level - visibleMinLevel) / levelRange * plotWidth;
  const transformedYMin = transformEarningsChartYValue(yDomain.min, yScale);
  const transformedYMax = transformEarningsChartYValue(yDomain.max, yScale);
  const yForValue = (value: number) => chartDimensions.top
    + (transformedYMax - transformEarningsChartYValue(value, yScale))
      / (transformedYMax - transformedYMin)
      * plotHeight;
  const calloutWidth = 150;
  const calloutHeight = 42;
  const hoveredSeriesCallout = hoveredSeries
    ? getEarningsChartCalloutPosition({
      pointX: xForLevel(activePoint.level),
      pointY: yForValue(hoveredSeries.value),
      calloutWidth,
      calloutHeight,
      minX: chartDimensions.left,
      maxX: chartDimensions.width - chartDimensions.right,
      minY: chartDimensions.top,
      maxY: chartDimensions.top + plotHeight,
    })
    : null;
  const yAxisLabel = data.comparisonMode === 'per-minute'
    ? labels.trendAxisPerMinute
    : labels.trendAxisElapsed;
  const accessibleValueSummary = visibleActivityIds.map((id) => {
    const value = activePoint.values[id];
    return `${getActivityLabel(id, locale)} ${value === null
      ? labels.notAvailable
      : formatChartValue(formatNumber, value)}`;
  }).join('; ');
  const hasNegativeAiCrafting = visibleActivityIds.includes('ai-crafting')
    && data.points.some((point) => {
      const value = point.values['ai-crafting'];
      return typeof value === 'number' && Number.isFinite(value) && value < 0;
    });

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;

    const updateWidth = (nextWidth: number) => {
      if (nextWidth <= 0) return;
      const roundedWidth = Math.round(nextWidth);
      setContainerWidth((currentWidth) =>
        currentWidth === roundedWidth ? currentWidth : roundedWidth,
      );
    };

    updateWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => updateWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onHoverPoint(null);
      onHoverSeries(null);
      onClearSelection();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectPoint(activePointIndex);
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onHoverPoint(null);
    onHoverSeries(null);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(data.points.length - 1, activePointIndex + direction));
    const nextPoint = data.points[nextIndex];
    if (nextPoint) viewportControls.ensureLevelVisible(nextPoint.level);
    onKeyboardPoint(nextIndex);
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    suppressTouchClickRef.current = false;
    if (event.pointerType !== 'touch') return;
    touchGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = touchGestureRef.current;
    if (gesture?.pointerId === event.pointerId && !gesture.moved
      && hasChartTouchGestureMoved(
        gesture.startX,
        gesture.startY,
        event.clientX,
        event.clientY,
      )) {
      touchGestureRef.current = { ...gesture, moved: true };
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = touchGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    suppressTouchClickRef.current = gesture.moved;
    touchGestureRef.current = null;
    onHoverPoint(null);
    onHoverSeries(null);
  };

  const handlePointerCancel = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = touchGestureRef.current;
    if (event.pointerType !== 'touch' && gesture?.pointerId !== event.pointerId) return;
    suppressTouchClickRef.current = true;
    touchGestureRef.current = null;
    onHoverPoint(null);
    onHoverSeries(null);
  };

  return (
    <div
      ref={chartContainerRef}
      className="w-full min-w-0"
      data-comparison-mode={data.comparisonMode}
      data-visible-series-count={visibleActivityIds.length}
    >
      <ChartViewportControls
        locale={locale}
        canZoomIn={viewportControls.canZoomIn}
        canZoomOut={viewportControls.canZoomOut}
        isFullRange={viewportControls.isFullRange}
        viewport={viewportControls.viewport}
        sliderValue={viewportControls.sliderValue}
        onZoomIn={viewportControls.zoomIn}
        onZoomOut={viewportControls.zoomOut}
        onReset={viewportControls.reset}
        onSliderChange={viewportControls.onSliderChange}
      />
      {yScale.mode === 'symlog' ? (
        <p
          className="mb-2 text-xs leading-5 text-muted-foreground"
          data-earnings-chart-scale-note="symlog"
        >
          {labels.trendScaleCompressed}
        </p>
      ) : null}
      {hasNegativeAiCrafting ? (
        <p
          className="mb-2 text-xs leading-5 text-muted-foreground"
          data-earnings-chart-negative-ai-hint="true"
        >
          {getMessages(locale).tools.earningsOverview.trendAiNegativeHint}
        </p>
      ) : null}
      <svg
        role="group"
        tabIndex={0}
        aria-labelledby="earnings-chart-svg-title earnings-chart-y-axis-label"
        aria-describedby="earnings-chart-interaction-hint"
        aria-label={`${formatTemplate(labels.trendSelectedLevel, { level: activePoint.level })}，${accessibleValueSummary}`}
        viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
        data-chart-width={chartDimensions.width}
        data-chart-x-min={visibleMinLevel}
        data-chart-x-max={visibleMaxLevel}
        data-chart-point-count={data.points.length}
        data-chart-series-count={data.activityIds.length}
        data-chart-tick-count={levelTicks.length}
        data-chart-y-tick-count={valueTicks.length}
        data-chart-y-min={yDomain.min}
        data-chart-y-max={yDomain.max}
        data-chart-y-scale={yScale.mode}
        data-active-level={activePoint.level}
        className="block h-auto w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        style={{ touchAction: 'pan-y pinch-zoom' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={(event) => {
          if (event.detail !== 0 && suppressTouchClickRef.current) {
            suppressTouchClickRef.current = false;
            return;
          }
          if (event.detail === 0 || !isClientPointInChartPlot(
            event.clientX,
            event.clientY,
            event.currentTarget,
            chartDimensions.width,
            chartDimensions.height,
            chartDimensions.left,
            chartDimensions.top,
            plotWidth,
            plotHeight,
          )) return;
          const index = getPointFromClientX(
            event.clientX,
            event.currentTarget,
            data,
            chartDimensions.width,
            chartDimensions.left,
            plotWidth,
            viewportControls.viewport,
          );
          if (index !== null) onSelectPoint(index);
        }}
        onFocus={() => {
          viewportControls.ensureLevelVisible(activePoint.level);
          onKeyboardPoint(activePointIndex);
        }}
        onBlur={() => onKeyboardPoint(null)}
        onKeyDown={handleKeyDown}
      >
        <title id="earnings-chart-svg-title">{labels.trendTitle}</title>
        <defs>
          <clipPath id={plotClipPathId}>
            <rect
              x={chartDimensions.left}
              y={chartDimensions.top}
              width={plotWidth}
              height={plotHeight}
            />
          </clipPath>
        </defs>
        <text
          id="earnings-chart-y-axis-label"
          data-chart-axis="y"
          x={chartDimensions.left}
          y={chartDimensions.top - 10}
          textAnchor="start"
          fill="var(--color-fd-muted-foreground)"
          fontSize="12"
          fontWeight="600"
        >
          {yAxisLabel}
        </text>

        {valueTicks.map((value, index) => {
          const y = yForValue(value);
          const isZero = value === 0;
          return (
            <g key={`value-tick-${index}`}>
              <line
                data-zero-baseline={isZero ? 'true' : undefined}
                x1={chartDimensions.left}
                x2={chartDimensions.width - chartDimensions.right}
                y1={y}
                y2={y}
                stroke={isZero ? 'var(--color-fd-foreground)' : 'var(--color-fd-border)'}
                strokeDasharray={isZero ? undefined : '2 5'}
                strokeOpacity={isZero ? 0.55 : 1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={chartDimensions.left - chartYAxisTickGap}
                y={y + 4}
                textAnchor="end"
                fill="var(--color-fd-muted-foreground)"
                fontSize="12"
              >
                {formatChartAxisTick(formatNumber, value)}
              </text>
            </g>
          );
        })}

        <g clipPath={`url(#${plotClipPathId})`} data-earnings-chart-clipped-plot="true">
          {visibleActivityIds.map((id) => {
            const style = seriesStyleById.get(id)!;
            return (
              <path
                key={id}
                data-earnings-chart-series={id}
                fill="none"
                stroke={style.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={style.dashArray}
                vectorEffect="non-scaling-stroke"
                d={getLinePath(data, id, xForLevel, yForValue)}
                aria-hidden="true"
              />
            );
          })}

          <g data-selected-level="true" aria-hidden="true">
            <line
              x1={xForLevel(activePoint.level)}
              x2={xForLevel(activePoint.level)}
              y1={chartDimensions.top}
              y2={chartDimensions.top + plotHeight}
              stroke="var(--color-fd-primary)"
              strokeDasharray="5 4"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {visibleActivityIds.flatMap((id) => {
              const value = activePoint.values[id];
              if (value === null) return [];
              const style = seriesStyleById.get(id)!;
              return (
                <circle
                  key={id}
                  cx={xForLevel(activePoint.level)}
                  cy={yForValue(value)}
                  r="5"
                  fill="var(--color-fd-background)"
                  stroke={style.color}
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        </g>

        {hoveredSeries && hoveredSeriesCallout ? (() => {
          const style = seriesStyleById.get(hoveredSeries.activityId)!;
          const label = getActivityLabel(hoveredSeries.activityId, locale);
          const value = `${formatChartValue(formatNumber, hoveredSeries.value)} ${labels.aiUnit}`;
          return (
            <g
              data-earnings-chart-hover-callout="true"
              data-earnings-chart-hover-activity={hoveredSeries.activityId}
              data-earnings-chart-hover-placement={hoveredSeriesCallout.placement}
              aria-hidden="true"
            >
              <rect
                x={hoveredSeriesCallout.x}
                y={hoveredSeriesCallout.y}
                width={calloutWidth}
                height={calloutHeight}
                rx="4"
                fill="var(--color-fd-background)"
                stroke={style.color}
                strokeOpacity="0.9"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={hoveredSeriesCallout.x + 8}
                y={hoveredSeriesCallout.y + 16}
                fill={style.color}
                fontSize="11"
                fontWeight="600"
              >
                {label}
              </text>
              <text
                x={hoveredSeriesCallout.x + 8}
                y={hoveredSeriesCallout.y + 32}
                fill="var(--color-fd-foreground)"
                fontSize="10"
              >
                {value}
              </text>
            </g>
          );
        })() : null}

        <line
          x1={chartDimensions.left}
          x2={chartDimensions.width - chartDimensions.right}
          y1={chartDimensions.top + plotHeight}
          y2={chartDimensions.top + plotHeight}
          stroke="var(--color-fd-foreground)"
          strokeOpacity="0.45"
        />
        {levelTicks.map((level, index) => {
          const x = xForLevel(level);
          return (
            <g key={level}>
              <line
                x1={x}
                x2={x}
                y1={chartDimensions.top + plotHeight}
                y2={chartDimensions.top + plotHeight + 6}
                stroke="var(--color-fd-foreground)"
                strokeOpacity="0.45"
              />
              <text
                x={x}
                y={chartDimensions.top + plotHeight + 24}
                data-chart-axis-tick="x"
                textAnchor={getChartTickTextAnchor(index, levelTicks.length)}
                fill="var(--color-fd-muted-foreground)"
                fontSize="12"
              >
                {level}
              </text>
            </g>
          );
        })}
        <text
          x={chartDimensions.left + plotWidth / 2}
          y={chartDimensions.height - 9}
          textAnchor="middle"
          fill="var(--color-fd-muted-foreground)"
          fontSize="12"
        >
          {labels.trendAxisLevel}
        </text>

        <rect
          data-earnings-chart-interaction-layer="true"
          x={chartDimensions.left}
          y={chartDimensions.top}
          width={plotWidth}
          height={plotHeight}
          fill="transparent"
          aria-hidden="true"
          onPointerMove={(event) => {
            const svg = event.currentTarget.ownerSVGElement;
            const index = getPointFromClientX(
              event.clientX,
              svg,
              data,
              chartDimensions.width,
              chartDimensions.left,
              plotWidth,
              viewportControls.viewport,
            );
            if (index === null) {
              onHoverPoint(null);
              onHoverSeries(null);
              return;
            }
            onHoverPoint(index);
            const pointerY = getViewBoxYFromClientY(
              event.clientY,
              svg,
              chartDimensions.height,
            );
            onHoverSeries(pointerY === null
              ? null
              : findNearestEarningsChartSeries(
                data,
                visibleActivityIds,
                index,
                  pointerY,
                  yForValue,
                  {
                    minY: chartDimensions.top,
                    maxY: chartDimensions.top + plotHeight,
                  },
                ));
          }}
          onPointerLeave={() => {
            onHoverPoint(null);
            onHoverSeries(null);
          }}
          onPointerOut={() => {
            onHoverPoint(null);
            onHoverSeries(null);
          }}
        />
      </svg>
    </div>
  );
}

export function EarningsTrendChart({
  labels,
  locale,
  inputs,
  prices,
  comparisonMode,
  numberFormatter,
}: {
  readonly labels: EarningsOverviewToolLabels;
  readonly locale: Locale;
  readonly inputs: EarningsInputs;
  readonly prices: ResolvedMarketPrices;
  readonly comparisonMode: EarningsComparisonMode;
  readonly numberFormatter?: NumberFormatter;
}) {
  const [activeGroupId, setActiveGroupId] = useState<EarningsChartGroupId>(
    defaultEarningsChartGroupId,
  );
  const [selection, dispatchSelection] = useReducer(
    reduceChartSelection,
    initialChartSelectionState,
  );
  const [hoveredSeries, setHoveredSeries] = useState<EarningsChartHoverTarget | null>(null);
  const [visibleVariableActivityIds, setVisibleVariableActivityIds] = useState<
    readonly EarningsActivityId[]
  >(defaultEarningsChartVisibleActivityIds);
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );
  const chartData = useMemo(
    () => deriveEarningsChartData(inputs, prices, comparisonMode),
    [comparisonMode, inputs, prices],
  );
  const activeGroup = getEarningsChartGroup(activeGroupId);
  const visibleActivityIds = activeGroupId === 'variable'
    ? variableEarningsChartActivityIds.filter((activityId) =>
        visibleVariableActivityIds.includes(activityId),
      )
    : activeGroup.activityIds;
  const defaultPointIndex = Math.max(
    0,
    Math.min(chartData.points.length - 1, inputs.searchLevel - chartData.minLevel),
  );
  const activePointIndex = getChartSelectionIndex(selection, defaultPointIndex)!;
  const activePoint = chartData.points[activePointIndex]!;
  const resolvedHoveredSeries = hoveredSeries && selection.pointerIndex !== null
    ? (() => {
        const value = chartData.points[selection.pointerIndex]?.values[hoveredSeries.activityId];
        return typeof value === 'number' && Number.isFinite(value)
          ? { ...hoveredSeries, value }
          : null;
      })()
    : null;

  return (
    <section
      className="not-prose min-w-0"
      data-earnings-chart="true"
      data-earnings-chart-group={activeGroupId}
      aria-labelledby="earnings-chart-heading"
    >
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle id="earnings-chart-heading" className="site-tool-section-heading">{labels.trendTitle}</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          <Tabs.Root
            value={activeGroupId}
            onValueChange={(value) => {
              if (isEarningsChartGroupId(value)) {
                setActiveGroupId(value);
                dispatchSelection({ type: 'pointer-leave' });
                setHoveredSeries(null);
              }
            }}
            className="min-w-0"
          >
            <div className="min-w-0" data-earnings-chart-group-switcher="true">
              <p id="earnings-chart-group-label" className="text-sm font-medium text-foreground">
                {labels.trendGroup}
              </p>
              <div
                className="mt-3 min-w-0 overflow-x-auto"
                data-earnings-chart-group-scroll="true"
              >
                <Tabs.List
                  aria-label={labels.trendGroup}
                  activateOnFocus
                  className="flex w-max min-w-full gap-1 rounded-md border border-border bg-muted/40 p-1"
                >
                  {earningsChartGroups.map((group) => (
                    <Tabs.Tab
                      key={group.id}
                      value={group.id}
                      className="shrink-0 rounded-[calc(var(--cco-button-radius)-2px)] px-3 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30 aria-selected:bg-background aria-selected:text-foreground aria-selected:shadow-sm"
                    >
                      {getGroupLabel(group.id, labels)}
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </div>
            </div>

            <Tabs.Panel value={activeGroupId} className="min-w-0">
              {activeGroupId === 'fixed' ? null : (
                <div
                  className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-foreground"
                  data-earnings-chart-legend="true"
                  role="group"
                  aria-label={labels.trendLegend}
                >
                  {selectableVariableEarningsChartActivityIds.map((id) => {
                    const style = seriesStyleById.get(id)!;
                    const isVisible = visibleVariableActivityIds.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        className="inline-flex min-w-0 items-center gap-2 rounded-sm px-1 py-0.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/30 aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:font-medium"
                        aria-pressed={isVisible}
                        aria-label={`${getActivityLabel(id, locale)}: ${isVisible
                          ? labels.trendLegendVisible
                          : labels.trendLegendHidden}`}
                        data-earnings-chart-legend-toggle={id}
                        onClick={() => {
                          setVisibleVariableActivityIds((current) => current.includes(id)
                            ? current.filter((candidate) => candidate !== id)
                            : [...current, id]);
                          setHoveredSeries(null);
                        }}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 8" className={`h-2 w-6 shrink-0 transition-opacity ${isVisible ? 'opacity-100' : 'opacity-35'}`}>
                          <line
                            x1="1"
                            x2="23"
                            y1="4"
                            y2="4"
                            stroke={style.color}
                            strokeWidth="2"
                            strokeDasharray={style.dashArray}
                          />
                        </svg>
                        <span className="min-w-0">{getActivityLabel(id, locale)}</span>
                      </button>
                    );
                  })}
                  <span
                    className="inline-flex min-w-0 items-center gap-2 rounded-sm px-1 py-0.5 text-muted-foreground"
                    data-earnings-chart-legend-reference="yellow-box"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 8" className="h-2 w-6 shrink-0">
                      <line
                        x1="1"
                        x2="23"
                        y1="4"
                        y2="4"
                        stroke={seriesStyleById.get('yellow-box')!.color}
                        strokeWidth="2"
                        strokeDasharray={seriesStyleById.get('yellow-box')!.dashArray}
                      />
                    </svg>
                    <span className="min-w-0">{getActivityLabel('yellow-box', locale)} ({labels.trendLegendReference})</span>
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-sm px-1 py-0.5 text-muted-foreground underline decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                    onClick={() => {
                      setVisibleVariableActivityIds(defaultEarningsChartVisibleActivityIds);
                      setHoveredSeries(null);
                    }}
                    data-earnings-chart-legend-reset="true"
                  >
                    {labels.trendLegendReset}
                  </button>
                </div>
              )}

              {activeGroupId === 'fixed' ? null : (
                <p
                  id="earnings-chart-interaction-hint"
                  className="sr-only"
                >
                  {labels.trendInteractionHint}
                </p>
              )}

              <div className="mt-6 min-w-0 max-w-full">
                {activeGroupId === 'fixed' ? (
                  <EarningsFixedBarChart
                    data={chartData}
                    labels={labels}
                    locale={locale}
                    formatNumber={formatNumber}
                  />
                ) : (
                  <>
                    <div
                      className="w-full min-w-0 max-w-full"
                      data-chart-region="true"
                      role="region"
                      aria-label={labels.trendTitle}
                    >
                      <EarningsChartSvg
                        data={chartData}
                        visibleActivityIds={visibleActivityIds}
                        activePointIndex={activePointIndex}
                        hoveredSeries={resolvedHoveredSeries}
                        labels={labels}
                        locale={locale}
                        formatNumber={formatNumber}
                        onHoverPoint={(index) => dispatchSelection(index === null
                          ? { type: 'pointer-leave' }
                          : { type: 'pointer-move', index })}
                        onHoverSeries={setHoveredSeries}
                        onKeyboardPoint={(index) => dispatchSelection(index === null
                          ? { type: 'keyboard-blur' }
                          : { type: 'keyboard-focus', index })}
                        onSelectPoint={(index) => dispatchSelection({ type: 'pin', index })}
                        onClearSelection={() => dispatchSelection({ type: 'reset' })}
                      />
                    </div>
                    <EarningsChartDetails
                      point={activePoint}
                      visibleActivityIds={visibleActivityIds}
                      labels={labels}
                      locale={locale}
                      formatNumber={formatNumber}
                    />
                  </>
                )}
              </div>
            </Tabs.Panel>
          </Tabs.Root>
        </CardContent>
      </Card>
    </section>
  );
}
