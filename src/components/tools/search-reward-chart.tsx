'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

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
import { defaultSearchRewards } from '@/lib/search-reward';
import {
  deriveSearchRewardChartData,
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
  if (min === max) return [min];

  return Array.from({ length: divisions + 1 }, (_, index) => index / divisions)
    .map((ratio) => Math.round(min + (max - min) * ratio))
    .filter((value, index, values) => values.indexOf(value) === index);
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
  formatNumber: NumberFormatter;
  onHoverPoint: (index: number | null) => void;
  onFocusPoint: (index: number | null) => void;
  onSelectPoint: (index: number) => void;
  onClearTemporarySelection: () => void;
}) {
  const series = getSeries(metric, labels);
  const yAxisLabel = metric === 'value' ? labels.chartAxisValue : labels.chartAxisQuantity;
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pointRefs = useRef<Array<SVGCircleElement | null>>([]);
  const [containerWidth, setContainerWidth] = useState(chartDefaultWidth);
  const chartDimensions = getSearchRewardChartDimensions(containerWidth);
  const chartPlotWidth = chartDimensions.width - chartDimensions.left - chartDimensions.right;
  const chartPlotHeight = chartDimensions.height - chartDimensions.top - chartDimensions.bottom;
  const minLevel = data.minLevel;
  const maxLevel = data.maxLevel;
  const levelRange = Math.max(1, maxLevel - minLevel);
  const maxValue = Math.max(
    0,
    ...series.flatMap((item) => data.points.map((point) => item.getValue(point))),
  );
  const valueRange = maxValue > 0 ? maxValue : 1;
  const xForLevel = (level: number) =>
    chartDimensions.left + ((level - minLevel) / levelRange) * chartPlotWidth;
  const yForValue = (value: number) =>
    chartDimensions.top + chartPlotHeight - (value / valueRange) * chartPlotHeight;
  const levelTicks = getAxisTicks(minLevel, maxLevel);
  const valueTicks = getAxisTicks(0, valueRange);
  const activePoint = activePointIndex === null ? undefined : data.points[activePointIndex];
  const tabEntryIndex = activePointIndex
    ?? getNearestPointIndex(data.points, currentLevel)
    ?? 0;
  const selectedSeriesValue = activePoint
    ? Math.max(...series.map((item) => item.getValue(activePoint)))
    : null;
  const currentX = currentLevel === null
    ? null
    : xForLevel(Math.max(minLevel, Math.min(maxLevel, currentLevel)));
  const currentLevelLabelUsesStartAnchor = currentX !== null
    && currentX <= chartDimensions.left + 96;
  const currentLevelLabelX = currentX === null
    ? null
    : currentX + (currentLevelLabelUsesStartAnchor ? 10 : -10);

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

  const handlePointKeyDown = (event: KeyboardEvent<SVGCircleElement>, index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClearTemporarySelection();
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onHoverPoint(null);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(data.points.length - 1, index + direction));
    onFocusPoint(nextIndex);
    pointRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      ref={chartContainerRef}
      className="w-full min-w-[40rem]"
      data-chart-metric={metric}
    >
      <svg
        role="group"
        aria-labelledby="search-reward-chart-svg-title search-reward-chart-y-axis-label"
        aria-describedby="search-reward-chart-interaction-hint"
        viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
        data-chart-width={chartDimensions.width}
        data-chart-tick-count={levelTicks.length}
        data-chart-y-tick-count={valueTicks.length}
        className="block h-auto w-full"
      >
        <title id="search-reward-chart-svg-title">{labels.chartTitle}</title>
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

        {valueTicks.map((value) => {
          const y = yForValue(value);
          return (
            <g key={`value-tick-${value}`}>
              <line
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
            fill="none"
            stroke={item.color}
            strokeWidth={item.id === 'value' ? 3 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={item.dashArray}
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
              vectorEffect="non-scaling-stroke"
              data-ladder-point="true"
              aria-hidden="true"
            />
          ))
        )) : null}

        {activePoint && selectedSeriesValue !== null ? (
          <g data-selected-point="true" aria-hidden="true">
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
            <line
              x1={chartDimensions.left}
              x2={chartDimensions.width - chartDimensions.right}
              y1={yForValue(selectedSeriesValue)}
              y2={yForValue(selectedSeriesValue)}
              stroke="var(--color-fd-primary)"
              strokeDasharray="5 4"
              strokeOpacity="0.5"
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

        {currentX !== null ? (
          <g aria-hidden="true">
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
            <g key={`level-tick-${level}`}>
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
          onPointerMove={(event) => {
            const index = getNearestPointFromClientX(
              event.clientX,
              event.currentTarget.ownerSVGElement,
            );
            if (index !== null) onHoverPoint(index);
          }}
          onPointerLeave={() => onHoverPoint(null)}
          onClick={(event) => {
            const index = getNearestPointFromClientX(
              event.clientX,
              event.currentTarget.ownerSVGElement,
            );
            if (index !== null) onSelectPoint(index);
          }}
        />

        {data.points.map((point, index) => (
          <circle
            key={`point-target-${point.level}`}
            ref={(element) => {
              pointRefs.current[index] = element;
            }}
            cx={xForLevel(point.level)}
            cy={yForValue(series[0]?.getValue(point) ?? 0)}
            r="12"
            fill="transparent"
            stroke="transparent"
            strokeWidth="2"
            tabIndex={index === tabEntryIndex ? 0 : -1}
            role="button"
            aria-label={getPointAccessibleLabel(point, labels, formatNumber)}
            aria-pressed={pinnedPointIndex === index}
            onMouseEnter={() => onHoverPoint(index)}
            onMouseLeave={() => onHoverPoint(null)}
            onFocus={() => onFocusPoint(index)}
            onBlur={() => onFocusPoint(null)}
            onClick={() => onSelectPoint(index)}
            onKeyDown={(event) => handlePointKeyDown(event, index)}
          />
        ))}
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
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const [focusedPointIndex, setFocusedPointIndex] = useState<number | null>(null);
  const [pinnedPointIndex, setPinnedPointIndex] = useState<number | null>(null);
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
  const activePointIndex = hoveredPointIndex
    ?? focusedPointIndex
    ?? pinnedPointIndex
    ?? defaultPointIndex;
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
        <CardHeader>
          <CardTitle id="search-reward-chart-heading" className="site-tool-section-heading">{labels.chartTitle}</CardTitle>
        </CardHeader>
        <CardContent>
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
                className="mt-5 rounded-md border border-border bg-muted/40 p-3 text-sm leading-6 text-muted-foreground"
              >
                {labels.chartInteractionHint}
              </p>

              <div className="mt-6 min-w-0 max-w-full">
                <div
                  className="w-full min-w-0 max-w-full overflow-x-auto"
                  data-chart-scroll-container="true"
                  role="region"
                  aria-label={labels.chartTitle}
                  tabIndex={0}
                >
                  <SearchRewardChartSvg
                    data={chartData}
                    metric={metric}
                    currentLevel={inputs?.playerLevel ?? null}
                    activePointIndex={activePointIndex}
                    pinnedPointIndex={pinnedPointIndex}
                    labels={labels}
                    formatNumber={formatNumber}
                    onHoverPoint={setHoveredPointIndex}
                    onFocusPoint={setFocusedPointIndex}
                    onSelectPoint={setPinnedPointIndex}
                    onClearTemporarySelection={() => {
                      setHoveredPointIndex(null);
                      setFocusedPointIndex(null);
                    }}
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
