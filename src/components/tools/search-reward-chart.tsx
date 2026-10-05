'use client';

import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

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
import { defaultSearchRewards } from '@/lib/search-reward';
import {
  deriveSearchRewardChartData,
  findNearestSearchRewardChartSeries,
  getSearchRewardChartCalloutLayout,
  getSearchRewardChartCalloutPosition,
  type SearchRewardChartData,
  type SearchRewardChartMetric,
  type SearchRewardChartPoint,
} from '@/lib/search-reward-chart';
import { createNumberFormatter, type NumberFormatter } from '@/lib/number-formatting';
import type { Locale } from '@/lib/i18n';

import {
  useSearchRewardTool,
  type SearchRewardToolLabels,
} from './search-reward-calculator';
import { ChartViewportControls, useChartViewport } from './chart-viewport';

export function getSearchRewardChartDimensions(containerWidth: number) {
  return getResponsiveChartDimensions(containerWidth, {
    compactTop: 24,
    wideTop: 30,
  });
}

type ChartSeriesId = 'medical' | 'ammo' | 'military' | 'value';

interface ChartSeries {
  readonly id: ChartSeriesId;
  readonly label: string;
  readonly color: string;
  readonly dashArray?: string;
  readonly getValue: (point: SearchRewardChartPoint) => number;
}

function getSeries(
  metric: SearchRewardChartMetric,
  labels: SearchRewardToolLabels,
): readonly ChartSeries[] {
  if (metric === 'value') {
    return [{
      id: 'value',
      label: labels.expectedValue,
      color: 'var(--cco-color-info)',
      getValue: (point) => point.totalExpectedValue,
    }];
  }

  return [
    {
      id: 'medical',
      label: labels.medicalParts,
      color: 'var(--cco-color-info)',
      getValue: (point) => point.expectedMtQty,
    },
    {
      id: 'ammo',
      label: labels.ammoParts,
      color: 'var(--cco-color-warning)',
      dashArray: '9 5',
      getValue: (point) => point.expectedAtpQty,
    },
    {
      id: 'military',
      label: labels.militaryAmmoParts,
      color: 'var(--cco-color-success)',
      dashArray: '2 5',
      getValue: (point) => point.expectedMatpQty,
    },
  ];
}

function getAxisTicks(min: number, max: number, divisions = 4): readonly number[] {
  return Array.from({ length: divisions + 1 }, (_, index) =>
    min + (max - min) * index / divisions,
  );
}

function getLinePath(
  points: readonly SearchRewardChartPoint[],
  getValue: (point: SearchRewardChartPoint) => number,
  xForLevel: (level: number) => number,
  yForValue: (value: number) => number,
) {
  return points
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${xForLevel(point.level)} ${yForValue(getValue(point))}`;
    })
    .join(' ');
}

function formatChartTemplate(
  template: string,
  replacements: Record<string, string | number>,
) {
  return Object.entries(replacements).reduce(
    (message, [key, value]) => message.replace(`\${${key}}`, String(value)),
    template,
  );
}

function formatDataValue(formatNumber: NumberFormatter, value: number) {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

function getNearestPointIndex(
  points: readonly SearchRewardChartPoint[],
  level: number | null,
) {
  if (points.length === 0) return null;
  if (level === null) return 0;

  return points.reduce(
    (nearestIndex, point, index) => {
      const nearest = points[nearestIndex];
      if (!nearest) return index;
      return Math.abs(point.level - level) < Math.abs(nearest.level - level)
        ? index
        : nearestIndex;
    },
    0,
  );
}

function isClientPointInChartPlot(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  dimensions: ReturnType<typeof getSearchRewardChartDimensions>,
) {
  const bounds = svg.getBoundingClientRect();
  const x = (clientX - bounds.left) / Math.max(1, bounds.width) * dimensions.width;
  const y = (clientY - bounds.top) / Math.max(1, bounds.height) * dimensions.height;
  return x >= dimensions.left
    && x <= dimensions.width - dimensions.right
    && y >= dimensions.top
    && y <= dimensions.height - dimensions.bottom;
}

function getPointAccessibleLabel(
  point: SearchRewardChartPoint,
  labels: SearchRewardToolLabels,
  formatNumber: NumberFormatter,
) {
  return [
    formatChartTemplate(labels.area, { level: point.areaLevel }),
    `${labels.expectedValue} ${formatDataValue(formatNumber, point.totalExpectedValue)} ${labels.expectedValueUnit}`,
    `${labels.medicalParts} ${formatDataValue(formatNumber, point.expectedMtQty)}`,
    `${labels.ammoParts} ${formatDataValue(formatNumber, point.expectedAtpQty)}`,
    `${labels.militaryAmmoParts} ${formatDataValue(formatNumber, point.expectedMatpQty)}`,
  ].join('，');
}

function ChartLegend({
  metric,
  currentLevel,
  labels,
}: {
  metric: SearchRewardChartMetric;
  currentLevel: number | null;
  labels: SearchRewardToolLabels;
}) {
  const series = getSeries(metric, labels);

  return (
    <div className="mt-5 space-y-3">
      <p className="text-sm font-medium text-foreground">{labels.chartLegend}</p>
      <ul aria-label={labels.chartLegend} className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {series.map((item) => (
          <li key={item.id} className="inline-flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block w-6 shrink-0 border-t-2"
              style={{
                borderColor: item.color,
                borderStyle: item.dashArray ? 'dashed' : 'solid',
              }}
            />
            <span className="min-w-0 text-muted-foreground">{item.label}</span>
          </li>
        ))}
        {metric === 'value' ? (
          <li className="inline-flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block size-3 shrink-0 rounded-full border-2 border-warning bg-card"
            />
            <span className="min-w-0 text-muted-foreground">{labels.chartLadderPointLabel}</span>
          </li>
        ) : null}
        {currentLevel !== null ? (
          <li className="inline-flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-block h-4 w-px shrink-0 border-l-2 border-dashed border-primary"
            />
            <span className="min-w-0 text-muted-foreground">{labels.chartCurrentLevel}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function SearchRewardChartSvg({
  data,
  metric,
  currentLevel,
  activePointIndex,
  pinnedPointIndex,
  labels,
  locale,
  formatNumber,
  onHoverPoint,
  onFocusPoint,
  onSelectPoint,
  onClearTemporarySelection,
}: {
  data: SearchRewardChartData;
  metric: SearchRewardChartMetric;
  currentLevel: number | null;
  activePointIndex: number | null;
  pinnedPointIndex: number | null;
  labels: SearchRewardToolLabels;
  locale: Locale;
  formatNumber: NumberFormatter;
  onHoverPoint: (index: number | null) => void;
  onFocusPoint: (index: number | null) => void;
  onSelectPoint: (index: number) => void;
  onClearTemporarySelection: () => void;
}) {
  const series = getSeries(metric, labels);
  const yAxisLabel = metric === 'value' ? labels.chartAxisValue : labels.chartAxisQuantity;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartClipPathId = `search-reward-chart-plot-${useId()}`;
  const touchGestureRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressTouchClickRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(chartDefaultWidth);
  const chartDimensions = getSearchRewardChartDimensions(containerWidth);
  const chartPlotWidth = chartDimensions.width - chartDimensions.left - chartDimensions.right;
  const chartPlotHeight = chartDimensions.height - chartDimensions.top - chartDimensions.bottom;
  const minLevel = data.minLevel;
  const maxLevel = data.maxLevel;
  const chartDomain = { min: minLevel, max: maxLevel };
  const viewportControls = useChartViewport(chartDomain);
  const visibleMinLevel = viewportControls.viewport.min;
  const visibleMaxLevel = viewportControls.viewport.max;
  const levelRange = Math.max(1, visibleMaxLevel - visibleMinLevel);
  const maxValue = Math.max(
    0,
    ...series.flatMap((item) => data.points.map((point) => item.getValue(point))),
  );
  const valueRange = maxValue > 0 ? maxValue : 1;
  const xForLevel = (level: number) =>
    chartDimensions.left + ((level - visibleMinLevel) / levelRange) * chartPlotWidth;
  const yForValue = (value: number) =>
    chartDimensions.top + chartPlotHeight - (value / valueRange) * chartPlotHeight;
  const levelTicks = getChartViewportTicks(viewportControls.viewport).map(Math.round);
  const valueTicks = getAxisTicks(0, valueRange);
  const activePoint = activePointIndex === null ? undefined : data.points[activePointIndex];
  const [hoveredSeriesId, setHoveredSeriesId] = useState<ChartSeriesId | null>(null);
  const hoveredSeries = hoveredSeriesId === null
    ? undefined
    : series.find((item) => item.id === hoveredSeriesId);
  const hoveredSeriesValue = activePoint && hoveredSeries
    ? hoveredSeries.getValue(activePoint)
    : null;
  const hoveredSeriesDisplayValue = hoveredSeriesValue === null
    ? null
    : metric === 'value'
      ? `${formatDataValue(formatNumber, hoveredSeriesValue)} ${labels.expectedValueUnit}`
      : formatDataValue(formatNumber, hoveredSeriesValue);
  const hoveredSeriesCalloutLayout = hoveredSeries && hoveredSeriesDisplayValue !== null
    ? getSearchRewardChartCalloutLayout(
      hoveredSeries.label,
      hoveredSeriesDisplayValue,
      chartPlotWidth,
    )
    : null;
  const hoveredSeriesCallout = activePoint && hoveredSeries && hoveredSeriesValue !== null
    && hoveredSeriesCalloutLayout
    ? getSearchRewardChartCalloutPosition({
      pointX: xForLevel(activePoint.level),
      pointY: yForValue(hoveredSeriesValue),
      calloutWidth: hoveredSeriesCalloutLayout.width,
      calloutHeight: hoveredSeriesCalloutLayout.height,
      minX: chartDimensions.left,
      maxX: chartDimensions.width - chartDimensions.right,
      minY: chartDimensions.top,
      maxY: chartDimensions.top + chartPlotHeight,
    })
    : null;
  const tabEntryIndex = activePointIndex
    ?? getNearestPointIndex(data.points, currentLevel)
    ?? 0;
  const currentX = currentLevel === null
    || currentLevel < visibleMinLevel
    || currentLevel > visibleMaxLevel
    ? null
    : xForLevel(currentLevel);
  const currentLevelLabelUsesStartAnchor = currentX !== null
    && currentX <= chartDimensions.left + 96;
  const currentLevelLabelX = currentX === null
    ? null
    : currentX + (currentLevelLabelUsesStartAnchor ? 10 : -10);

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

    if (!isClientPointInChartPlot(
      event.clientX,
      event.clientY,
      event.currentTarget,
      chartDimensions,
    )) {
      onHoverPoint(null);
      setHoveredSeriesId(null);
      return;
    }

    const index = getNearestPointFromClientX(event.clientX, event.currentTarget);
    if (index === null) {
      onHoverPoint(null);
      setHoveredSeriesId(null);
      return;
    }

    onHoverPoint(index);
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerY = ((event.clientY - bounds.top) / Math.max(1, bounds.height))
      * chartDimensions.height;
    const point = data.points[index];
    const target = point
      ? findNearestSearchRewardChartSeries(
        series.map((item) => ({ id: item.id, value: item.getValue(point) })),
        pointerY,
        yForValue,
        {
          minY: chartDimensions.top,
          maxY: chartDimensions.top + chartPlotHeight,
        },
      )
      : null;
    setHoveredSeriesId(target?.id ?? null);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = touchGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    suppressTouchClickRef.current = gesture.moved;
    touchGestureRef.current = null;
    onHoverPoint(null);
    setHoveredSeriesId(null);
  };

  const handlePointerCancel = (event: ReactPointerEvent<SVGSVGElement>) => {
    const gesture = touchGestureRef.current;
    if (event.pointerType !== 'touch' && gesture?.pointerId !== event.pointerId) return;
    suppressTouchClickRef.current = true;
    touchGestureRef.current = null;
    onHoverPoint(null);
    setHoveredSeriesId(null);
  };

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

    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const getNearestPointFromClientX = (clientX: number, svg: SVGSVGElement | null) => {
    const bounds = svg?.getBoundingClientRect();
    if (!bounds || data.points.length === 0) return null;

    const viewBoxX = ((clientX - bounds.left) / Math.max(1, bounds.width)) * chartDimensions.width;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    data.points.forEach((point, index) => {
      const distance = Math.abs(xForLevel(point.level) - viewBoxX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  };

  const handleChartKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setHoveredSeriesId(null);
      onClearTemporarySelection();
      return;
    }

    if (event.key === 'Enter') {
      if (activePointIndex === null) return;
      event.preventDefault();
      setHoveredSeriesId(null);
      onSelectPoint(activePointIndex);
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (data.points.length === 0) return;
    event.preventDefault();
    setHoveredSeriesId(null);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(
      data.points.length - 1,
      (activePointIndex ?? tabEntryIndex) + direction,
    ));
    const nextPoint = data.points[nextIndex];
    if (nextPoint) viewportControls.ensureLevelVisible(nextPoint.level);
    onFocusPoint(nextIndex);
  };

  return (
    <div
      ref={chartContainerRef}
      className="w-full min-w-0"
      data-chart-metric={metric}
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
      <svg
        role="group"
        tabIndex={0}
        aria-labelledby="search-reward-chart-svg-title search-reward-chart-y-axis-label"
        aria-describedby="search-reward-chart-interaction-hint search-reward-chart-active-point-description"
        viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
        data-chart-width={chartDimensions.width}
        data-chart-x-min={visibleMinLevel}
        data-chart-x-max={visibleMaxLevel}
        data-chart-y-min={0}
        data-chart-y-max={valueRange}
        data-chart-tick-count={levelTicks.length}
        data-chart-y-tick-count={valueTicks.length}
        className="block h-auto w-full rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        style={{ touchAction: 'pan-y pinch-zoom' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          onHoverPoint(null);
          setHoveredSeriesId(null);
        }}
        onClick={(event) => {
          if (event.detail !== 0 && suppressTouchClickRef.current) {
            suppressTouchClickRef.current = false;
            return;
          }
          if (event.detail === 0 || !isClientPointInChartPlot(
            event.clientX,
            event.clientY,
            event.currentTarget,
            chartDimensions,
          )) return;
          const index = getNearestPointFromClientX(event.clientX, event.currentTarget);
          if (index !== null) onSelectPoint(index);
        }}
        onFocus={() => {
          const point = data.points[tabEntryIndex];
          if (point) viewportControls.ensureLevelVisible(point.level);
          setHoveredSeriesId(null);
          onFocusPoint(tabEntryIndex);
        }}
        onBlur={() => {
          setHoveredSeriesId(null);
          onFocusPoint(null);
        }}
        onKeyDown={handleChartKeyDown}
      >
        <title id="search-reward-chart-svg-title">{labels.chartTitle}</title>
        <desc id="search-reward-chart-active-point-description">
          {activePoint ? getPointAccessibleLabel(activePoint, labels, formatNumber) : labels.chartTitle}
        </desc>
        <defs>
          <clipPath id={chartClipPathId}>
            <rect
              x={chartDimensions.left}
              y={chartDimensions.top}
              width={chartPlotWidth}
              height={chartPlotHeight}
            />
          </clipPath>
        </defs>
        <text
          id="search-reward-chart-y-axis-label"
          data-chart-axis="y"
          x={chartDimensions.left}
          y={chartDimensions.top - 9}
          textAnchor="start"
          fill="var(--color-fd-muted-foreground)"
          fontSize="12"
          fontWeight="600"
        >
          {yAxisLabel}
        </text>

        {valueTicks.map((value, index) => {
          const y = yForValue(value);
          return (
            <g key={`value-tick-${index}`}>
              <line
                data-chart-y-gridline="true"
                x1={chartDimensions.left}
                x2={chartDimensions.width - chartDimensions.right}
                y1={y}
                y2={y}
                stroke="var(--color-fd-border)"
                strokeDasharray="2 5"
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

        {series.map((item) => (
          <path
            key={item.id}
            data-search-reward-chart-series={item.id}
            fill="none"
            stroke={item.color}
            strokeWidth={item.id === 'value' ? 3 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={item.dashArray}
            clipPath={`url(#${chartClipPathId})`}
            vectorEffect="non-scaling-stroke"
            d={getLinePath(data.points, item.getValue, xForLevel, yForValue)}
            aria-hidden="true"
          />
        ))}

        {metric === 'value' ? data.points.filter((point) => point.isLadderPoint).flatMap((point) => (
          series.map((item) => (
            <circle
              key={`ladder-point-${item.id}-${point.level}`}
              cx={xForLevel(point.level)}
              cy={yForValue(item.getValue(point))}
              r="4.5"
              fill="var(--color-fd-background)"
              stroke="var(--cco-color-warning)"
              strokeWidth="2"
              clipPath={`url(#${chartClipPathId})`}
              vectorEffect="non-scaling-stroke"
              data-ladder-point="true"
              aria-hidden="true"
            />
          ))
        )) : null}

        {activePoint ? (
          <g
            data-selected-point="true"
            aria-hidden="true"
            clipPath={`url(#${chartClipPathId})`}
          >
            <line
              x1={xForLevel(activePoint.level)}
              x2={xForLevel(activePoint.level)}
              y1={chartDimensions.top}
              y2={chartDimensions.top + chartPlotHeight}
              stroke="var(--color-fd-primary)"
              strokeDasharray="5 4"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {series.map((item) => (
              <circle
                key={`selected-point-${item.id}`}
                cx={xForLevel(activePoint.level)}
                cy={yForValue(item.getValue(activePoint))}
                r="6"
                fill="var(--color-fd-background)"
                stroke={item.color}
                strokeWidth="3"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ) : null}

        {hoveredSeries && hoveredSeriesCallout && hoveredSeriesCalloutLayout
          && hoveredSeriesDisplayValue !== null ? (
            <g
              data-search-reward-chart-hover-callout="true"
              data-search-reward-chart-hover-series={hoveredSeries.id}
              data-search-reward-chart-hover-placement={hoveredSeriesCallout.placement}
              aria-hidden="true"
              pointerEvents="none"
            >
              <rect
                x={hoveredSeriesCallout.x}
                y={hoveredSeriesCallout.y}
                width={hoveredSeriesCalloutLayout.width}
                height={hoveredSeriesCalloutLayout.height}
                rx="4"
                fill="var(--color-fd-background)"
                stroke={hoveredSeries.color}
                strokeOpacity="0.9"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={hoveredSeriesCallout.x + 8}
                y={hoveredSeriesCallout.y + 16}
                fill={hoveredSeries.color}
                fontSize="11"
                fontWeight="600"
              >
                {hoveredSeriesCalloutLayout.labelLines.map((line, index) => (
                  <tspan key={`label-${index}`} x={hoveredSeriesCallout.x + 8} dy={index === 0 ? 0 : 14}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text
                x={hoveredSeriesCallout.x + 8}
                y={hoveredSeriesCallout.y + 32 + (hoveredSeriesCalloutLayout.labelLines.length - 1) * 14}
                fill="var(--color-fd-foreground)"
                fontSize="10"
              >
                {hoveredSeriesCalloutLayout.valueLines.map((line, index) => (
                  <tspan key={`value-${index}`} x={hoveredSeriesCallout.x + 8} dy={index === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            </g>
          ) : null}

        {currentX !== null ? (
          <g aria-hidden="true" clipPath={`url(#${chartClipPathId})`}>
            <line
              data-current-level-line="true"
              x1={currentX}
              x2={currentX}
              y1={chartDimensions.top}
              y2={chartDimensions.top + chartPlotHeight}
              stroke="var(--color-fd-primary)"
              strokeDasharray="5 4"
              strokeWidth="2"
              strokeOpacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
            <text
              data-current-level-label="true"
              x={currentLevelLabelX ?? currentX}
              y={chartDimensions.top + 18}
              textAnchor={currentLevelLabelUsesStartAnchor ? 'start' : 'end'}
              fill="var(--color-fd-primary)"
              fontSize="12"
              fontWeight="600"
            >
              {labels.chartCurrentLevel}
            </text>
          </g>
        ) : null}

        <line
          x1={chartDimensions.left}
          x2={chartDimensions.width - chartDimensions.right}
          y1={chartDimensions.top + chartPlotHeight}
          y2={chartDimensions.top + chartPlotHeight}
          stroke="var(--color-fd-foreground)"
          strokeOpacity="0.45"
        />
        {levelTicks.map((level, index) => {
          const x = xForLevel(level);
          return (
            <g key={`level-tick-${index}`}>
              <line
                x1={x}
                x2={x}
                y1={chartDimensions.top + chartPlotHeight}
                y2={chartDimensions.top + chartPlotHeight + 6}
                stroke="var(--color-fd-foreground)"
                strokeOpacity="0.45"
              />
              <text
                x={x}
                y={chartDimensions.top + chartPlotHeight + 24}
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
          x={chartDimensions.left + chartPlotWidth / 2}
          y={chartDimensions.height - 9}
          textAnchor="middle"
          fill="var(--color-fd-muted-foreground)"
          fontSize="12"
        >
          {labels.chartAxisLevel}
        </text>

        <rect
          x={chartDimensions.left}
          y={chartDimensions.top}
          width={chartPlotWidth}
          height={chartPlotHeight}
          fill="transparent"
          aria-hidden="true"
        />

      </svg>
    </div>
  );
}

function SearchRewardPointDetails({
  point,
  labels,
  formatNumber,
}: {
  point: SearchRewardChartPoint;
  labels: SearchRewardToolLabels;
  formatNumber: NumberFormatter;
}) {
  const items = [
    [labels.medicalParts, point.expectedMtQty],
    [labels.ammoParts, point.expectedAtpQty],
    [labels.militaryAmmoParts, point.expectedMatpQty],
  ] as const;

  return (
    <div
      className="@container mt-4 rounded-md border border-primary/40 bg-primary/5 p-4"
      data-selected-point-details="true"
      aria-live="polite"
    >
      <dl
        className="grid items-center gap-x-5 gap-y-2 text-sm @min-[24rem]:grid-cols-2"
        data-point-details-summary="true"
      >
        <div>
          <dt className="sr-only">{labels.chartAxisLevel}</dt>
          <dd className="font-semibold text-foreground">
            {formatChartTemplate(labels.area, { level: point.areaLevel })}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-muted-foreground">{labels.expectedValue}</dt>
          <dd className="font-semibold text-foreground">
            {formatDataValue(formatNumber, point.totalExpectedValue)} {labels.expectedValueUnit}
          </dd>
        </div>
      </dl>
      <dl
        className="mt-3 grid gap-x-5 gap-y-2 border-t border-border pt-3 text-sm @min-[36rem]:grid-cols-3"
        data-point-details-output="true"
      >
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-semibold text-foreground">{formatDataValue(formatNumber, value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function SearchRewardChart({
  labels,
  locale,
  numberFormatter,
}: {
  labels: SearchRewardToolLabels;
  locale: Locale;
  numberFormatter?: NumberFormatter;
}) {
  const { inputs } = useSearchRewardTool();
  const [metric, setMetric] = useState<SearchRewardChartMetric>('value');
  const [selection, dispatchSelection] = useReducer(
    reduceChartSelection,
    initialChartSelectionState,
  );
  const formatNumber = useMemo(
    () => numberFormatter ?? createNumberFormatter(locale),
    [locale, numberFormatter],
  );
  const chartData = useMemo(
    () => inputs
      ? deriveSearchRewardChartData(defaultSearchRewards, inputs.prices, inputs.searchCount)
      : null,
    [inputs],
  );
  const defaultPointIndex = chartData
    ? getNearestPointIndex(chartData.points, inputs?.playerLevel ?? null)
    : null;
  const activePointIndex = getChartSelectionIndex(selection, defaultPointIndex);
  const activePoint = activePointIndex === null || !chartData
    ? undefined
    : chartData.points[activePointIndex];

  return (
    <section
      className="not-prose my-8 min-w-0"
      data-search-reward-chart="true"
      aria-labelledby="search-reward-chart-heading"
    >
      <Card>
        <CardHeader className="px-3 sm:px-6">
          <CardTitle id="search-reward-chart-heading" className="site-tool-section-heading">{labels.chartTitle}</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pt-0 sm:px-6">
          {chartData ? (
            <>
              <fieldset className="min-w-0">
                <legend className="text-sm font-medium text-foreground">
                  {labels.chartMetricLabel}
                </legend>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                  {([
                    ['value', labels.chartMetricValue],
                    ['quantity', labels.chartMetricQuantity],
                  ] as const).map(([value, label]) => {
                    const id = `search-reward-chart-metric-${value}`;
                    return (
                      <label key={value} htmlFor={id} className="inline-flex items-center gap-2 text-sm text-foreground">
                        <input
                          id={id}
                          type="radio"
                          name="search-reward-chart-metric"
                          value={value}
                          checked={metric === value}
                          onChange={() => setMetric(value)}
                          className="size-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <p
                id="search-reward-chart-interaction-hint"
                className="sr-only"
              >
                {labels.chartInteractionHint}
              </p>

              <div className="mt-6 min-w-0 max-w-full">
                <div
                  className="w-full min-w-0 max-w-full"
                  data-chart-region="true"
                  role="region"
                  aria-label={labels.chartTitle}
                >
                  <SearchRewardChartSvg
                    data={chartData}
                    metric={metric}
                    currentLevel={inputs?.playerLevel ?? null}
                    locale={locale}
                    activePointIndex={activePointIndex}
                    pinnedPointIndex={selection.pinnedIndex}
                    labels={labels}
                    formatNumber={formatNumber}
                    onHoverPoint={(index) => dispatchSelection(index === null
                      ? { type: 'pointer-leave' }
                      : { type: 'pointer-move', index })}
                    onFocusPoint={(index) => dispatchSelection(index === null
                      ? { type: 'keyboard-blur' }
                      : { type: 'keyboard-focus', index })}
                    onSelectPoint={(index) => dispatchSelection({ type: 'pin', index })}
                    onClearTemporarySelection={() => dispatchSelection({ type: 'reset' })}
                  />
                </div>
                <ChartLegend
                  currentLevel={inputs?.playerLevel ?? null}
                  metric={metric}
                  labels={labels}
                />
                {activePoint ? (
                  <SearchRewardPointDetails
                    point={activePoint}
                    labels={labels}
                    formatNumber={formatNumber}
                  />
                ) : null}
              </div>

              <p className="sr-only">
                {labels.chartAxisLevel}：{chartData.minLevel}–{chartData.maxLevel}。
              </p>
            </>
          ) : (
            <div role="status" className="rounded-md border border-dashed border-border p-5">
              <p className="font-medium text-foreground">{labels.chartNoData}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {labels.chartNoDataHint}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
