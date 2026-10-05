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

import { ChartViewportControls, useChartViewport } from './chart-viewport';
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
  it('依容器寬度配置 desktop 與窄畫布，保留長負數刻度空間', () => {
    const compact = getEarningsChartDimensions(360);
    const mobile = getEarningsChartDimensions(320);
    const wideMobile = getEarningsChartDimensions(400);
    const desktop = getEarningsChartDimensions(960);

    expect(compact).toMatchObject({
      width: 360,
      height: 220,
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
    expect(mobile).toMatchObject({ width: 320, height: 210 });
    expect(wideMobile).toMatchObject({ width: 400, height: 230 });
    expect(compact.width - compact.left - compact.right).toBeGreaterThan(300);
    expect(desktop.width - desktop.left - desktop.right).toBeGreaterThan(858);
    expect(compact.left - chartYAxisTickGap).toBeGreaterThanOrEqual(
      chartYAxisTickLabelReserve,
    );
    expect(estimateChartTickLabelWidth(
      formatChartAxisTick(createNumberFormatter('en'), -999.9),
    )).toBeLessThanOrEqual(compact.left - chartYAxisTickGap);
  });

  it('呈現 800 個等級、預設變動收益系列、兩個檢視與容器自適應畫布', () => {
    const markup = renderToStaticMarkup(chart('per-minute'));
    const parsed = document.createElement('div');
    parsed.innerHTML = markup;
    const cardContent = parsed.querySelector(
      '[data-earnings-chart] > div > div:last-child',
    );
    const cardHeader = parsed.querySelector(
      '[data-earnings-chart] > div > div:first-child',
    );

    expect(markup).toContain('data-earnings-chart="true"');
    expect(cardHeader?.className).toContain('px-3');
    expect(cardHeader?.className).toContain('sm:px-6');
    expect(cardContent?.className).toContain('px-3');
    expect(cardContent?.className).toContain('sm:px-6');
    expect(markup).toContain('data-earnings-chart-group="variable"');
    expect(markup).toContain('data-chart-point-count="800"');
    expect(markup).toContain('data-chart-series-count="16"');
    expect(markup).toContain(`data-visible-series-count="${defaultEarningsChartVisibleActivityIds.length}"`);
    expect(markup).toContain('data-chart-tick-count="5"');
    expect(markup).toContain('data-chart-y-tick-count="5"');
    expect(markup).not.toContain('min-w-[40rem]');
    expect(markup).toContain('data-chart-viewport-controls="true"');
    expect(markup).toContain('data-chart-viewport-slider="true"');
    expect(markup).toContain('目前可見等級範圍: 1–800');
    expect(markup).toContain('size-11');
    expect(markup).toContain('data-chart-x-min="1"');
    expect(markup).toContain('data-chart-x-max="800"');
    expect(markup).toContain('pan-y pinch-zoom');
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
    const chartRegion = parsed.querySelector('[data-chart-region]');
    const viewportSlider = parsed.querySelector('[data-chart-viewport-slider]');
    const viewportButtons = parsed.querySelector('[data-chart-viewport-action="zoom-in"]')
      ?.parentElement;
    expect(parsed.querySelectorAll('svg[tabindex="0"]')).toHaveLength(1);
    expect(viewportSlider?.className).toContain('h-11');
    expect(viewportSlider?.className).toContain('min-h-11');
    expect(viewportButtons?.className).toContain('flex-wrap');
    expect(viewportButtons?.className).toContain('max-w-full');
    expect(chartRegion?.className).not.toContain('overflow-x-auto');
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

  it('操作提示僅供螢幕閱讀器，群組小字已移除且圖表描述參照有效', () => {
    const parsed = document.createElement('div');
    parsed.innerHTML = renderToStaticMarkup(chart('per-minute'));
    const interactionHint = parsed.querySelector<HTMLElement>(
      '#earnings-chart-interaction-hint',
    );
    const chartSvg = parsed.querySelector('svg[tabindex="0"]');
    const describedByIds = (chartSvg?.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean);

    expect(interactionHint?.className).toBe('sr-only');
    expect(interactionHint?.textContent).toBe(labels.trendInteractionHint);
    expect(Array.from(parsed.querySelectorAll('p'))
      .some((paragraph) => paragraph.textContent?.trim() === labels.trendGroupHint))
      .toBe(false);
    expect(Array.from(parsed.querySelectorAll('p'))
      .some((paragraph) => paragraph.textContent?.trim() === labels.trendDescription))
      .toBe(false);
    expect(describedByIds).toContain('earnings-chart-interaction-hint');
    expect(describedByIds.length).toBeGreaterThan(0);
    for (const id of describedByIds) {
      expect(parsed.querySelector(`[id="${id}"]`)).not.toBeNull();
    }
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
    expect(container.querySelector('[data-chart-viewport-controls]')).toBeNull();
    expect(container.querySelectorAll('[data-earnings-chart-fixed-row]')).toHaveLength(9);
    expect(Array.from(container.querySelectorAll<HTMLElement>('[data-earnings-chart-fixed-row]'))
      .map((row) => row.getAttribute('data-earnings-chart-fixed-activity')))
      .toEqual(getFixedEarningsChartRows(deriveEarningsChartData(inputs, prices, 'per-minute'))
        .map((row) => row.activityId));
    expect(container.querySelectorAll('[data-earnings-chart-fixed-zero-axis]')).toHaveLength(9);
    expect(container.querySelector('[data-earnings-chart-fixed="true"]')?.getAttribute('aria-label'))
      .toBe(labels.trendFixedHint);
    expect(container.querySelector('[data-earnings-chart-fixed-hint]')).toBeNull();
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
    expect(container.querySelector('[data-earnings-chart-details]')?.textContent)
      .toContain('Lv.1');

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
      .toContain('Lv.120');

    await unmount(root);
  });

  it('切換 Tabs 無例外、清除 hover 與系列提示並保留移動後的 pin', async () => {
    const { container, root } = await renderChart();
    const errors: unknown[] = [];
    const recordError = (event: ErrorEvent) => errors.push(event.error);
    window.addEventListener('error', recordError);
    try {
      const svg = container.querySelector<SVGSVGElement>('svg[tabindex="0"]')!;
      const layer = container.querySelector<SVGRectElement>(
        '[data-earnings-chart-interaction-layer]',
      )!;
      Object.defineProperty(svg, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, width: 960, height: 400 }),
      });
      await act(async () => {
        svg.dispatchEvent(new MouseEvent('click', {
          bubbles: true, detail: 1, clientX: 498, clientY: 160,
        }));
      });
      const clickedLevel = svg.getAttribute('data-active-level');
      const dimensions = getEarningsChartDimensions(960);
      const yMin = Number(svg.getAttribute('data-chart-y-min'));
      const yMax = Number(svg.getAttribute('data-chart-y-max'));
      const firstSearchValue = deriveEarningsChartData(inputs, prices, 'per-minute')
        .points[0]?.values.search ?? 0;
      const searchY = dimensions.top + (yMax - firstSearchValue) / (yMax - yMin)
        * (dimensions.height - dimensions.top - dimensions.bottom);
      await act(async () => {
        layer.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, clientX: 48, clientY: searchY,
        }));
      });
      expect(svg.getAttribute('data-active-level')).toBe('1');
      expect(svg.getAttribute('data-active-level')).not.toBe(clickedLevel);
      expect(container.querySelector('[data-earnings-chart-hover-callout]')).not.toBeNull();
      const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const fixedTab = tabs.find((tab) => tab.textContent === labels.trendGroupFixed)!;
      const variableTab = tabs.find((tab) => tab.textContent === labels.trendGroupVariable)!;
      await expect(act(async () => fixedTab.click())).resolves.toBeUndefined();
      expect(fixedTab.getAttribute('aria-selected')).toBe('true');
      await expect(act(async () => variableTab.click())).resolves.toBeUndefined();
      expect(errors).toEqual([]);
      expect(container.querySelector('svg[tabindex="0"]')?.getAttribute('data-active-level'))
        .toBe('1');
      expect(container.querySelector('[data-earnings-chart-hover-callout]')).toBeNull();
    } finally {
      window.removeEventListener('error', recordError);
      await unmount(root);
    }
  });

  it('觸控拖曳／取消不 pin；點按鎖定後滑鼠與觸控移動都保留新位置', async () => {
    const { container, root } = await renderChart();
    const svg = container.querySelector<SVGSVGElement>('svg[tabindex="0"]')!;
    const interactionLayer = container.querySelector<SVGRectElement>(
      '[data-earnings-chart-interaction-layer]',
    )!;
    const dimensions = getEarningsChartDimensions(960);
    const plotWidth = dimensions.width - dimensions.left - dimensions.right;
    const xAt = (level: number) => dimensions.left
      + (level - 1) / 799 * plotWidth;
    const dispatchTouchPointer = (
      target: SVGSVGElement | SVGRectElement,
      type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
      level: number,
      y: number,
      pointerId = 27,
    ) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      pointerId,
      pointerType: 'touch',
      isPrimary: true,
      clientX: xAt(level),
      clientY: y,
    }));
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 960, height: 400 }),
    });

    const data = deriveEarningsChartData(inputs, prices, 'per-minute');
    const yDomain = {
      min: Number(svg.getAttribute('data-chart-y-min')),
      max: Number(svg.getAttribute('data-chart-y-max')),
    };
    const yAtSearch = (level: number) => {
      const value = data.points[level - 1]?.values.search ?? 0;
      return dimensions.top + (yDomain.max - value) / (yDomain.max - yDomain.min)
        * (dimensions.height - dimensions.top - dimensions.bottom);
    };
    const hover = async (level: number) => {
      await act(async () => {
        interactionLayer.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          pointerType: 'mouse',
          clientX: xAt(level),
          clientY: yAtSearch(level),
        }));
        interactionLayer.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
      });
    };
    const click = (level: number) => svg.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      detail: 1,
      clientX: xAt(level),
      clientY: yAtSearch(level),
    }));

    await hover(300);
    expect(svg.getAttribute('data-active-level')).toBe('300');

    await act(async () => {
      dispatchTouchPointer(svg, 'pointerdown', 300, 150);
      dispatchTouchPointer(interactionLayer, 'pointermove', 350, 175);
      dispatchTouchPointer(svg, 'pointerup', 350, 175);
      click(350);
    });
    expect(svg.getAttribute('data-active-level')).toBe('350');
    expect(container.querySelector('[data-earnings-chart-hover-callout]')).toBeNull();
    await hover(500);
    expect(svg.getAttribute('data-active-level')).toBe('500');

    await act(async () => {
      dispatchTouchPointer(svg, 'pointerdown', 500, 150, 28);
      dispatchTouchPointer(interactionLayer, 'pointermove', 600, 160, 28);
      dispatchTouchPointer(svg, 'pointercancel', 600, 160, 28);
      click(600);
    });
    await hover(700);
    expect(svg.getAttribute('data-active-level')).toBe('700');

    await act(async () => {
      dispatchTouchPointer(svg, 'pointerdown', 250, 150, 29);
      dispatchTouchPointer(svg, 'pointerup', 250, 150, 29);
      click(250);
    });
    await hover(400);
    expect(svg.getAttribute('data-active-level')).toBe('400');

    await act(async () => {
      dispatchTouchPointer(svg, 'pointerdown', 400, yAtSearch(400), 30);
      dispatchTouchPointer(interactionLayer, 'pointermove', 450, yAtSearch(450), 30);
      dispatchTouchPointer(svg, 'pointerup', 450, yAtSearch(450), 30);
      interactionLayer.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    expect(svg.getAttribute('data-active-level')).toBe('450');

    await act(async () => root.unmount());
  });

  it('slider 可移至兩端並重設，圖內拖曳不平移且點選與鍵盤選取仍運作', async () => {
    const { container, root } = await renderChart();
    const svg = container.querySelector<SVGSVGElement>('svg[tabindex="0"]')!;
    const zoomIn = container.querySelector<HTMLButtonElement>(
      '[data-chart-viewport-action="zoom-in"]',
    )!;
    const reset = container.querySelector<HTMLButtonElement>(
      '[data-chart-viewport-action="reset"]',
    )!;
    const slider = container.querySelector<HTMLInputElement>('[data-chart-viewport-slider]')!;
    const yDomain = [svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')];
    expect(slider.disabled).toBe(true);

    await act(async () => zoomIn.click());
    const zoomedMin = Number(svg.getAttribute('data-chart-x-min'));
    const zoomedMax = Number(svg.getAttribute('data-chart-x-max'));
    const zoomedSpan = zoomedMax - zoomedMin;
    expect(slider.disabled).toBe(false);
    expect(zoomedSpan).toBeLessThan(799);
    expect(svg.getAttribute('data-chart-tick-count')).toBe('5');
    expect(svg.getAttribute('data-chart-y-tick-count')).toBe('5');
    expect([svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')])
      .toEqual(yDomain);

    const setSliderValue = async (value: number) => {
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        valueSetter?.call(slider, String(value));
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        await Promise.resolve();
      });
    };

    await setSliderValue(0);
    expect(svg.getAttribute('data-chart-x-min')).toBe('1');
    expect(Number(svg.getAttribute('data-chart-x-max'))).toBeCloseTo(1 + zoomedSpan);
    expect(Number(slider.value)).toBe(0);

    await setSliderValue(Number(slider.max));
    expect(Number(svg.getAttribute('data-chart-x-max'))).toBe(800);
    expect(Number(svg.getAttribute('data-chart-x-min'))).toBeCloseTo(800 - zoomedSpan);
    expect(Number(slider.value)).toBe(Number(slider.max));

    await setSliderValue(Math.round(Number(slider.max) / 2));
    const centeredMin = Number(svg.getAttribute('data-chart-x-min'));
    const centeredMax = Number(svg.getAttribute('data-chart-x-max'));
    expect(centeredMin).toBeGreaterThan(1);
    expect(centeredMax).toBeLessThan(800);
    expect(centeredMax - centeredMin).toBeCloseTo(zoomedSpan);

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 960, height: 400 }),
    });
    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 9,
        isPrimary: true,
        button: 0,
        clientX: 550,
        clientY: 160,
      }));
      svg.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 9,
        isPrimary: true,
        clientX: 430,
        clientY: 160,
      }));
      svg.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 9,
        isPrimary: true,
        clientX: 430,
        clientY: 160,
      }));
    });
    expect(Number(svg.getAttribute('data-chart-x-min'))).toBe(centeredMin);
    expect(Number(svg.getAttribute('data-chart-x-max'))).toBe(centeredMax);
    expect([svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')])
      .toEqual(yDomain);

    const selectedLevel = 400;
    const clickX = 48 + ((selectedLevel - centeredMin) / (centeredMax - centeredMin)) * 900;
    await act(async () => {
      svg.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        detail: 1,
        clientX: clickX,
        clientY: 160,
      }));
    });
    expect(svg.getAttribute('data-active-level')).toBe(String(selectedLevel));

    await act(async () => {
      svg.focus();
      svg.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }));
    });
    const keyboardMin = Number(svg.getAttribute('data-chart-x-min'));
    const keyboardMax = Number(svg.getAttribute('data-chart-x-max'));
    expect(svg.getAttribute('data-active-level')).toBe(String(selectedLevel - 1));
    expect(keyboardMin).toBeLessThanOrEqual(selectedLevel - 1);
    expect(keyboardMax).toBeGreaterThanOrEqual(selectedLevel - 1);
    expect(keyboardMax - keyboardMin).toBeCloseTo(zoomedSpan);
    expect([svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')])
      .toEqual(yDomain);

    await act(async () => reset.click());
    expect(svg.getAttribute('data-chart-x-min')).toBe('1');
    expect(svg.getAttribute('data-chart-x-max')).toBe('800');
    expect(slider.disabled).toBe(true);
    expect(container.querySelector('[data-chart-visible-range]')?.textContent)
      .toContain('目前可見等級範圍: 1–800');
    expect(container.querySelector('[data-earnings-chart-fixed]')).toBeNull();

    await unmount(root);
  });

  it('domain 變更會重設 viewport 與 slider 至新的完整範圍', async () => {
    function ViewportHarness({ domain }: { domain: { min: number; max: number } }) {
      const viewport = useChartViewport(domain);
      return (
        <>
          <ChartViewportControls
            locale="en"
            canZoomIn={viewport.canZoomIn}
            canZoomOut={viewport.canZoomOut}
            isFullRange={viewport.isFullRange}
            viewport={viewport.viewport}
            sliderValue={viewport.sliderValue}
            onZoomIn={viewport.zoomIn}
            onZoomOut={viewport.zoomOut}
            onReset={viewport.reset}
            onSliderChange={viewport.onSliderChange}
          />
          <output
            data-viewport-min={viewport.viewport.min}
            data-viewport-max={viewport.viewport.max}
          />
        </>
      );
    }

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => root.render(<ViewportHarness domain={{ min: 1, max: 100 }} />));

    const zoomIn = container.querySelector<HTMLButtonElement>(
      '[data-chart-viewport-action="zoom-in"]',
    )!;
    const slider = container.querySelector<HTMLInputElement>('[data-chart-viewport-slider]')!;
    await act(async () => zoomIn.click());
    expect(slider.disabled).toBe(false);
    expect(Number(container.querySelector('output')?.getAttribute('data-viewport-max')))
      .toBeLessThan(100);

    await act(async () => {
      root.render(<ViewportHarness domain={{ min: 10, max: 70 }} />);
    });
    expect(container.querySelector('output')?.getAttribute('data-viewport-min')).toBe('10');
    expect(container.querySelector('output')?.getAttribute('data-viewport-max')).toBe('70');
    expect(slider.disabled).toBe(true);
    expect(container.querySelector('[data-chart-visible-range]')?.textContent)
      .toContain('10–70');

    await unmount(root);
  });
});
