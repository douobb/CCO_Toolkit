'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';

import { getIntlLocale, type Locale } from '@/lib/i18n';
import {
  canZoomChartViewportIn,
  chartViewportSliderMax,
  ensureChartViewportLevelVisible,
  getChartViewportSliderValue,
  isChartViewportFull,
  setChartViewportSliderValue,
  zoomChartViewport,
  type ChartLevelDomain,
  type ChartViewport,
} from '@/lib/chart-viewport';

export function useChartViewport(domain: ChartLevelDomain) {
  const levelDomain = useMemo(
    () => ({ min: domain.min, max: domain.max }),
    [domain.min, domain.max],
  );
  const [viewportState, setViewportState] = useState(() => ({
    domainMin: levelDomain.min,
    domainMax: levelDomain.max,
    viewport: levelDomain,
  }));
  const domainChanged = viewportState.domainMin !== levelDomain.min
    || viewportState.domainMax !== levelDomain.max;
  const viewport = domainChanged ? levelDomain : viewportState.viewport;
  const viewportRef = useRef(viewportState);

  const updateViewport = useCallback((update: (current: ChartViewport) => ChartViewport) => {
    const stored = viewportRef.current;
    const current = stored.domainMin === levelDomain.min
      && stored.domainMax === levelDomain.max
      ? stored.viewport
      : levelDomain;
    const next = update(current);
    const nextState = {
      domainMin: levelDomain.min,
      domainMax: levelDomain.max,
      viewport: next,
    };
    viewportRef.current = nextState;
    setViewportState(nextState);
  }, [levelDomain]);

  const zoomIn = useCallback(() => {
    updateViewport((current) => zoomChartViewport(current, levelDomain, 'in'));
  }, [levelDomain, updateViewport]);
  const zoomOut = useCallback(() => {
    updateViewport((current) => zoomChartViewport(current, levelDomain, 'out'));
  }, [levelDomain, updateViewport]);
  const reset = useCallback(() => {
    updateViewport(() => ({ min: levelDomain.min, max: levelDomain.max }));
  }, [levelDomain, updateViewport]);
  const ensureLevelVisible = useCallback((level: number) => {
    updateViewport((current) => ensureChartViewportLevelVisible(current, levelDomain, level));
  }, [levelDomain, updateViewport]);
  const sliderValue = getChartViewportSliderValue(viewport, levelDomain);
  const onSliderChange = useCallback((value: number) => {
    updateViewport((current) => setChartViewportSliderValue(current, levelDomain, value));
  }, [levelDomain, updateViewport]);

  const isFullRange = isChartViewportFull(viewport, levelDomain);
  return {
    viewport,
    sliderValue,
    canZoomIn: canZoomChartViewportIn(viewport, levelDomain),
    canZoomOut: !isFullRange,
    isFullRange,
    zoomIn,
    zoomOut,
    reset,
    ensureLevelVisible,
    onSliderChange,
  };
}

const viewportControlLabels: Record<Locale, {
  group: string;
  horizontalPosition: string;
  visibleRange: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
}> = {
  'zh-tw': {
    group: '等級範圍縮放',
    horizontalPosition: '水平位置',
    visibleRange: '目前可見等級範圍',
    zoomIn: '放大圖表',
    zoomOut: '縮小圖表',
    reset: '重設範圍',
  },
  'zh-cn': {
    group: '等级范围缩放',
    horizontalPosition: '水平位置',
    visibleRange: '当前可见等级范围',
    zoomIn: '放大图表',
    zoomOut: '缩小图表',
    reset: '重置范围',
  },
  en: {
    group: 'Level range controls',
    horizontalPosition: 'Horizontal position',
    visibleRange: 'Visible levels',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    reset: 'Reset range',
  },
};

export function ChartViewportControls({
  locale,
  canZoomIn,
  canZoomOut,
  isFullRange,
  viewport,
  sliderValue,
  onZoomIn,
  onZoomOut,
  onReset,
  onSliderChange,
}: {
  readonly locale: Locale;
  readonly canZoomIn: boolean;
  readonly canZoomOut: boolean;
  readonly isFullRange: boolean;
  readonly viewport: ChartViewport;
  readonly sliderValue: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onReset: () => void;
  readonly onSliderChange: (value: number) => void;
}) {
  const labels = viewportControlLabels[locale];
  const sliderId = useId();
  const numberFormat = new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits: 1,
  });
  const visibleRange = `${numberFormat.format(viewport.min)}–${numberFormat.format(viewport.max)}`;
  const buttonClassName = 'inline-flex size-11 items-center justify-center rounded-md border border-border bg-background text-base font-semibold text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-45';

  return (
    <div
      className="mb-2 flex w-full min-w-0 flex-wrap items-end gap-3"
      role="group"
      aria-label={labels.group}
      data-chart-viewport-controls="true"
    >
      <div className="min-w-0 flex-1 basis-40">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 text-xs leading-5">
          <label htmlFor={sliderId} className="font-medium text-foreground">
            {labels.horizontalPosition}
          </label>
          <span className="text-muted-foreground" data-chart-visible-range="true">
            {labels.visibleRange}: {visibleRange}
          </span>
        </div>
        <input
          id={sliderId}
          type="range"
          className="block h-11 min-h-11 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-45"
          min={0}
          max={chartViewportSliderMax}
          step={1}
          value={sliderValue}
          aria-label={labels.horizontalPosition}
          aria-valuetext={`${labels.visibleRange}: ${visibleRange}`}
          data-chart-viewport-slider="true"
          disabled={isFullRange}
          onChange={(event) => onSliderChange(Number(event.currentTarget.value))}
        />
      </div>
      <div className="flex max-w-full flex-wrap justify-end gap-2">
        <button
          type="button"
          className={buttonClassName}
          aria-label={labels.zoomIn}
          title={labels.zoomIn}
          data-chart-viewport-action="zoom-in"
          disabled={!canZoomIn}
          onClick={onZoomIn}
        >
          <span aria-hidden="true">+</span>
        </button>
        <button
          type="button"
          className={buttonClassName}
          aria-label={labels.zoomOut}
          title={labels.zoomOut}
          data-chart-viewport-action="zoom-out"
          disabled={!canZoomOut}
          onClick={onZoomOut}
        >
          <span aria-hidden="true">−</span>
        </button>
        <button
          type="button"
          className={buttonClassName}
          aria-label={labels.reset}
          title={labels.reset}
          data-chart-viewport-action="reset"
          disabled={!canZoomOut}
          onClick={onReset}
        >
          <span aria-hidden="true">↺</span>
        </button>
      </div>
    </div>
  );
}
