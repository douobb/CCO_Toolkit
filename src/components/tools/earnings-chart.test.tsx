// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import {
  chartYAxisTickGap,
  chartYAxisTickLabelReserve,
  estimateChartTickLabelWidth,
  formatChartAxisTick,
} from '@/lib/chart-layout';
import {
  defaultEarningsChartActivityIds,
  defaultEarningsChartVisibleActivityIds,
  deriveEarningsChartData,
  earningsChartGroups,
  getFixedEarningsChartRows,
  getEarningsChartYDomain,
  selectableVariableEarningsChartActivityIds,
} from '@/lib/earnings-chart';
import { earningsActivityCatalog } from '@/data/game/earnings-activities';
import type { EarningsComparisonMode, EarningsInputs } from '@/lib/earnings-calculator';
import { resolveMarketPrices } from '@/lib/market-prices';
import { createNumberFormatter } from '@/lib/number-formatting';
import { defaultSharedUserInputs } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import { EarningsTrendChart, getEarningsChartDimensions } from './earnings-chart';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const labels = getMessages('zh-tw').tools.earningsOverview;
const inputs: EarningsInputs = {
  searchLevel: 120,
  printingLevel: 220,
  miningLevel: 320,
  bargainPercent: 20,
  btcBuffPercent: 40,
};
const prices = resolveMarketPrices(defaultSharedUserInputs);

function chart(mode: EarningsComparisonMode) {
  return (
    <EarningsTrendChart
      labels={labels}
      locale="zh-tw"
      inputs={inputs}
      prices={prices}
      comparisonMode={mode}
    />
  );
}

async function renderChart(mode: EarningsComparisonMode = 'per-minute') {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(chart(mode));
    await Promise.resolve();
  });
  return { container, root };
}

async function unmount(root: Root) {
  await act(async () => root.unmount());
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Earnings trend chart', () => {
  it('縮減 desktop 與窄畫布 gutter，同時保留長負數刻度空間', () => {
    const compact = getEarningsChartDimensions(360);
    const desktop = getEarningsChartDimensions(960);

    expect(compact).toMatchObject({
      width: 640,
      height: 320,
      left: 44,
      right: 8,
      top: 28,
      bottom: 44,
    });
    expect(desktop).toMatchObject({
      width: 960,
      height: 400,
      left: 48,
      right: 12,
      top: 32,
      bottom: 62,
    });
    expect(compact.width - compact.left - compact.right).toBeGreaterThan(566);
    expect(desktop.width - desktop.left - desktop.right).toBeGreaterThan(858);
    expect(compact.left - chartYAxisTickGap).toBeGreaterThanOrEqual(
      chartYAxisTickLabelReserve,
    );
    expect(estimateChartTickLabelWidth(
      formatChartAxisTick(createNumberFormatter('en'), -999.9),
    )).toBeLessThanOrEqual(compact.left - chartYAxisTickGap);
  });

  it('呈現 800 個等級、預設變動收益系列、兩個檢視與 40rem 橫向畫布', () => {
    const markup = renderToStaticMarkup(chart('per-minute'));

    expect(markup).toContain('data-earnings-chart="true"');
    expect(markup).toContain('data-earnings-chart-group="variable"');
    expect(markup).toContain('data-chart-point-count="800"');
    expect(markup).toContain('data-chart-series-count="16"');
    expect(markup).toContain(`data-visible-series-count="${defaultEarningsChartVisibleActivityIds.length}"`);
    expect(markup).toContain('data-chart-tick-count="5"');
    expect(markup).toContain('data-chart-y-tick-count="5"');
    expect(markup).toContain('min-w-[40rem]');
    expect(markup).toContain('overflow-x-auto');
    expect(markup).not.toContain('type="checkbox"');
    expect(markup).toContain('data-earnings-chart-group-scroll="true"');
    expect(markup).not.toContain('trendGroupBoxes');
    expect(markup).not.toContain('trendGroupCrushing');
    expect(markup).not.toContain('trendGroupBackpack');
    expect(markup).toContain('role="tablist"');
    expect(markup.match(/role="tab"/g)).toHaveLength(earningsChartGroups.length);
    expect(markup).toContain('aria-selected="true"');
    expect(markup.match(/data-earnings-chart-series=/g))
      .toHaveLength(defaultEarningsChartActivityIds.length);
    expect(markup.match(/data-earnings-chart-legend-toggle=/g))
      .toHaveLength(selectableVariableEarningsChartActivityIds.length);
    expect(markup).toContain('data-earnings-chart-legend-reset="true"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('data-earnings-chart-legend-reference="yellow-box"');
    const parsed = document.createElement('div');
    parsed.innerHTML = markup;
    expect(parsed.querySelectorAll('svg[tabindex="0"]')).toHaveLength(1);
    const clipPath = parsed.querySelector('svg[tabindex="0"] clipPath');
    const clippedPlot = parsed.querySelector('[data-earnings-chart-clipped-plot="true"]');
    const clipRect = clipPath?.querySelector('rect');
    const dimensions = getEarningsChartDimensions(960);
    expect(clipPath?.id).toBeTruthy();
    expect(clippedPlot?.getAttribute('clip-path')).toBe(`url(#${clipPath?.id})`);
    expect(clippedPlot?.querySelector('[data-selected-level]')).not.toBeNull();
    expect([
      clipRect?.getAttribute('x'),
      clipRect?.getAttribute('y'),
      clipRect?.getAttribute('width'),
      clipRect?.getAttribute('height'),
    ]).toEqual([
      String(dimensions.left),
      String(dimensions.top),
      String(dimensions.width - dimensions.left - dimensions.right),
      String(dimensions.height - dimensions.top - dimensions.bottom),
    ]);

    const twoCharts = document.createElement('div');
    twoCharts.innerHTML = renderToStaticMarkup(
      <div>{chart('per-minute')}{chart('per-minute')}</div>,
    );
    const clipIds = Array.from(twoCharts.querySelectorAll('svg clipPath'), (element) => element.id);
    expect(clipIds).toHaveLength(2);
    expect(new Set(clipIds).size).toBe(2);
    expect(parsed.querySelector('[data-earnings-chart-group-scroll]')?.className)
      .toContain('overflow-x-auto');
    const xTickLabels = parsed.querySelectorAll('[data-chart-axis-tick="x"]');
    expect(xTickLabels[0]?.getAttribute('text-anchor')).toBe('start');
    expect(xTickLabels[xTickLabels.length - 1]?.getAttribute('text-anchor')).toBe('end');
  });

  it('切換兩個檢視、切換與重設系列，固定收益改用九列長條', async () => {
    const { container, root } = await renderChart();
    const labelsByGroup = {
      variable: labels.trendGroupVariable,
      fixed: labels.trendGroupFixed,
    } as const;
    const variableTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((candidate) => candidate.textContent === labelsByGroup.variable)!;
    const fixedTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((candidate) => candidate.textContent === labelsByGroup.fixed)!;

    expect(variableTab.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelectorAll('[data-earnings-chart-series]')).toHaveLength(
      defaultEarningsChartVisibleActivityIds.length,
    );
    expect(
      Array.from(container.querySelectorAll<SVGPathElement>('[data-earnings-chart-series]'))
        .map((path) => path.getAttribute('data-earnings-chart-series')),
    ).toEqual(defaultEarningsChartVisibleActivityIds);
    expect(container.querySelectorAll('[data-earnings-chart-details]')).toHaveLength(1);
    for (const id of defaultEarningsChartVisibleActivityIds) {
      const label = earningsActivityCatalog.find((activity) => activity.id === id)?.labels['zh-tw'];
      expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
        .toContain(label);
    }

    const aiToggle = container.querySelector<HTMLButtonElement>(
      '[data-earnings-chart-legend-toggle="ai-crafting"]',
    )!;
    expect(aiToggle.getAttribute('aria-pressed')).toBe('false');
    const chartData = deriveEarningsChartData(inputs, prices, 'per-minute');
    const expectedAiDomain = getEarningsChartYDomain(
      chartData,
      [...defaultEarningsChartVisibleActivityIds, 'ai-crafting'],
    );
    expect(chartData.points.some((point) => (point.values['ai-crafting'] ?? 0) < 0)).toBe(true);
    await act(async () => aiToggle.click());
    expect(aiToggle.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-earnings-chart-series="ai-crafting"]')).not.toBeNull();
    expect(container.querySelector('svg[tabindex="0"]')?.getAttribute('data-chart-y-scale'))
      .toBe('linear');
    expect(container.querySelector('[data-earnings-chart-scale-note="symlog"]')).toBeNull();
    expect(container.querySelector('[data-earnings-chart-negative-ai-hint]')?.textContent)
      .toBe(labels.trendAiNegativeHint);
    expect(Number(container.querySelector<SVGSVGElement>('svg[tabindex="0"]')
      ?.getAttribute('data-chart-y-min'))).toBe(expectedAiDomain.min);
    expect(Number(container.querySelector<SVGSVGElement>('svg[tabindex="0"]')
      ?.getAttribute('data-chart-y-max'))).toBe(expectedAiDomain.max);
    expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
      .toContain(earningsActivityCatalog.find((activity) => activity.id === 'ai-crafting')?.labels['zh-tw']);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-earnings-chart-legend-reset="true"]')?.click();
    });
    expect(container.querySelector('[data-earnings-chart-series="ai-crafting"]')).toBeNull();
    expect(aiToggle.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('[data-earnings-chart-negative-ai-hint]')).toBeNull();
    expect(container.querySelector('svg[tabindex="0"]')?.getAttribute('data-chart-y-scale'))
      .toBe('linear');
    expect(container.querySelector('[data-earnings-chart-scale-note="symlog"]')).toBeNull();

    for (const id of ['search', 'mining', 'black-market-trash'] as const) {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          `[data-earnings-chart-legend-toggle="${id}"]`,
        )?.click();
      });
    }
    expect(container.querySelectorAll('[data-earnings-chart-series]')).toHaveLength(1);
    expect(container.querySelector('[data-earnings-chart-series="yellow-box"]')).not.toBeNull();
    const safeDomain = container.querySelector<SVGSVGElement>('svg[tabindex="0"]');
    expect(Number.isFinite(Number(safeDomain?.getAttribute('data-chart-y-min')))).toBe(true);
    expect(Number.isFinite(Number(safeDomain?.getAttribute('data-chart-y-max')))).toBe(true);
    expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
      .toContain(earningsActivityCatalog.find((activity) => activity.id === 'yellow-box')?.labels['zh-tw']);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-earnings-chart-legend-reset="true"]')?.click();
    });

    await act(async () => fixedTab.click());
    expect(container.querySelector('[data-earnings-chart-group]')?.getAttribute(
      'data-earnings-chart-group',
    )).toBe('fixed');
    expect(fixedTab.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('svg[tabindex="0"]')).toBeNull();
    expect(container.querySelectorAll('[data-earnings-chart-fixed-row]')).toHaveLength(9);
    expect(Array.from(container.querySelectorAll<HTMLElement>('[data-earnings-chart-fixed-row]'))
      .map((row) => row.getAttribute('data-earnings-chart-fixed-activity')))
      .toEqual(getFixedEarningsChartRows(deriveEarningsChartData(inputs, prices, 'per-minute'))
        .map((row) => row.activityId));
    expect(container.querySelectorAll('[data-earnings-chart-fixed-zero-axis]')).toHaveLength(9);
    expect(container.querySelector('[data-earnings-chart-fixed-hint]')?.textContent)
      .toContain(labels.trendFixedHint);
    expect(container.querySelector('[data-earnings-chart-details]')).toBeNull();
    expect(container.querySelector('[data-selected-level]')).toBeNull();
    expect(container.querySelector('[data-chart-scroll-container]')).toBeNull();

    const fixedGridTracks = Array.from(
      container.querySelectorAll<HTMLElement>('[data-earnings-chart-fixed-grid="true"]'),
    ).map((element) => element.className.match(/grid-cols-\[[^\]]+\]/)?.[0]);
    expect(fixedGridTracks.length).toBe(10);
    expect(new Set(fixedGridTracks).size).toBe(1);

    await act(async () => variableTab.click());

    const perMinutePath = container
      .querySelector('[data-earnings-chart-series="search"]')
      ?.getAttribute('d');
    await act(async () => {
      root.render(chart('elapsed-15'));
      await Promise.resolve();
    });
    const chartCanvas = container.querySelector('[data-comparison-mode="elapsed-15"]');
    const elapsedPath = container
      .querySelector('[data-earnings-chart-series="search"]')
      ?.getAttribute('d');

    expect(chartCanvas).not.toBeNull();
    expect(container.textContent).toContain(labels.trendAxisElapsed);
    expect(elapsedPath).not.toBe(perMinutePath);

    await unmount(root);
  });

  it('裁切繪圖區並保留 AI 負值明細，同時忽略超界值 hover', async () => {
    const { container, root } = await renderChart();
    const data = deriveEarningsChartData(inputs, prices, 'per-minute');
    const negativeAiIndex = data.points.findIndex(
      (point) => (point.values['ai-crafting'] ?? 0) < 0,
    );
    expect(negativeAiIndex).toBeGreaterThanOrEqual(0);

    await act(async () => {
      container.querySelector<HTMLButtonElement>(
        '[data-earnings-chart-legend-toggle="ai-crafting"]',
      )?.click();
    });
    for (const id of ['search', 'mining', 'black-market-trash'] as const) {
      await act(async () => {
        container.querySelector<HTMLButtonElement>(
          `[data-earnings-chart-legend-toggle="${id}"]`,
        )?.click();
      });
    }

    const svg = container.querySelector<SVGSVGElement>('svg[tabindex="0"]')!;
    const interactionLayer = container.querySelector<SVGRectElement>(
      '[data-earnings-chart-interaction-layer]',
    )!;
    const aiPath = container.querySelector<SVGPathElement>(
      '[data-earnings-chart-series="ai-crafting"]',
    )!;
    const clippedPlot = aiPath.closest('[data-earnings-chart-clipped-plot="true"]');
    const clipPathId = clippedPlot?.getAttribute('clip-path')?.match(/#(.+)\)/)?.[1];
    const clipRect = clipPathId
      ? Array.from(svg.querySelectorAll('clipPath'))
          .find((clipPath) => clipPath.id === clipPathId)
          ?.querySelector('rect')
      : null;
    const dimensions = getEarningsChartDimensions(960);
    const plotBottom = dimensions.height - dimensions.bottom;
    const aiPathValues = aiPath.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const aiPathYValues = aiPathValues.filter((_, index) => index % 2 === 1);

    expect(clipRect).not.toBeNull();
    expect(clippedPlot?.contains(container.querySelector('[data-selected-level]'))).toBe(true);
    expect(aiPathYValues.some((value) => value > plotBottom)).toBe(true);
    expect(container.querySelector('[data-earnings-chart-negative-ai-hint]')?.textContent)
      .toBe(labels.trendAiNegativeHint);

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 960,
        bottom: 400,
        width: 960,
        height: 400,
        toJSON: () => ({}),
      }),
    });
    const plotWidth = dimensions.width - dimensions.left - dimensions.right;
    const pointX = dimensions.left
      + negativeAiIndex / (data.points.length - 1) * plotWidth;

    await act(async () => {
      interactionLayer.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: pointX,
        clientY: plotBottom,
      }));
    });

    expect(container.querySelector('[data-earnings-chart-hover-callout]')
      ?.getAttribute('data-earnings-chart-hover-activity')).not.toBe('ai-crafting');
    const aiLabel = earningsActivityCatalog.find((activity) => activity.id === 'ai-crafting')
      ?.labels['zh-tw'];
    const aiRow = Array.from(container.querySelectorAll<HTMLElement>(
      '[data-earnings-chart-details] dl > div',
    )).find((row) => row.querySelector('dt')?.textContent === aiLabel);
    const negativeAiValue = data.points[negativeAiIndex]!.values['ai-crafting']!;
    const formattedValue = createNumberFormatter('zh-tw')(negativeAiValue, {
      maximumFractionDigits: 2,
    });
    expect(aiRow?.querySelector('dd')?.textContent)
      .toContain(`${formattedValue} ${labels.aiUnit}`);

    await unmount(root);
  });

  it('以單一圖表互動層支援 hover、click、方向鍵與 Escape', async () => {
    const { container, root } = await renderChart();
    const svg = container.querySelector<SVGSVGElement>('svg[tabindex="0"]')!;
    const interactionLayer = container.querySelector<SVGRectElement>(
      '[data-earnings-chart-interaction-layer]',
    )!;
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 960,
        bottom: 400,
        width: 960,
        height: 400,
        toJSON: () => ({}),
      }),
    });

    const data = deriveEarningsChartData(inputs, prices, 'per-minute');
    const firstSearchValue = data.points[0]?.values.search;
    const yDomain = {
      min: Number(svg.getAttribute('data-chart-y-min')),
      max: Number(svg.getAttribute('data-chart-y-max')),
    };
    const dimensions = getEarningsChartDimensions(960);
    const searchY = dimensions.top
      + (yDomain.max - (firstSearchValue ?? 0))
      / (yDomain.max - yDomain.min)
      * (dimensions.height - dimensions.top - dimensions.bottom);

    await act(async () => {
      interactionLayer.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: getEarningsChartDimensions(960).left,
        clientY: searchY,
      }));
    });
    expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
      .toContain('Lv.1');
    expect(container.querySelector('[data-earnings-chart-hover-callout]')
      ?.getAttribute('data-earnings-chart-hover-activity')).toBe('search');
    expect(container.querySelector('[data-earnings-chart-hover-callout]')
      ?.getAttribute('aria-hidden')).toBe('true');

    await act(async () => {
      interactionLayer.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    expect(container.querySelector('[data-earnings-chart-hover-callout]')).toBeNull();

    await act(async () => {
      interactionLayer.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 950,
      }));
      interactionLayer.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: 950,
      }));
      interactionLayer.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
      .toContain('Lv.800');

    await act(async () => {
      svg.focus();
      svg.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowLeft',
      }));
    });
    expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
      .toContain('Lv.799');

    await act(async () => {
      svg.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape',
      }));
    });
    expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
      .toContain('Lv.800');

    await unmount(root);
  });
});
