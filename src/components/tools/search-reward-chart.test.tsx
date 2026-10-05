// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import {
  chartYAxisTickGap,
  chartYAxisTickLabelReserve,
  estimateChartTickLabelWidth,
  formatChartAxisTick,
} from '@/lib/chart-layout';
import { createNumberFormatter } from '@/lib/number-formatting';
import { createSharedUserInputsStore } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import { SearchRewardCalculator, SearchRewardToolProvider } from './search-reward-calculator';
import {
  getSearchRewardChartDimensions,
  SearchRewardChart,
} from './search-reward-chart';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

function renderChartMarkup(locale: 'zh-tw' | 'zh-cn' | 'en' = 'zh-tw') {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <SearchRewardToolProvider>
        <SearchRewardChart labels={getMessages(locale).tools.searchReward} locale={locale} />
      </SearchRewardToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

const quantitySeriesIds = ['medical', 'ammo', 'military'] as const;

function getSeriesPoint(svg: SVGSVGElement, seriesId: string, index: number) {
  const path = svg.querySelector<SVGPathElement>(
    `[data-search-reward-chart-series="${seriesId}"]`,
  );
  const coordinates = path?.getAttribute('d')?.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi);
  const x = Number(coordinates?.[index * 2]);
  const y = Number(coordinates?.[index * 2 + 1]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function getDistinctSeriesPoint(svg: SVGSVGElement, seriesId: typeof quantitySeriesIds[number]) {
  const targetPath = svg.querySelector<SVGPathElement>(
    `[data-search-reward-chart-series="${seriesId}"]`,
  );
  const pointCount = targetPath?.getAttribute('d')?.match(/(?:^|\s)[ML]\s/gi)?.length ?? 0;

  for (let index = 0; index < pointCount; index += 1) {
    const point = getSeriesPoint(svg, seriesId, index);
    if (!point) continue;
    const separatedFromOtherSeries = quantitySeriesIds
      .filter((candidate) => candidate !== seriesId)
      .every((candidate) => {
        const otherPoint = getSeriesPoint(svg, candidate, index);
        return otherPoint !== null && Math.abs(otherPoint.y - point.y) > 12;
      });
    if (separatedFromOtherSeries) return point;
  }

  return null;
}

function dispatchPointerMove(svg: SVGSVGElement, point: { x: number; y: number }) {
  svg.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true,
    pointerType: 'mouse',
    clientX: point.x,
    clientY: point.y,
  }));
}

afterEach(() => {
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe('Search Reward chart UI', () => {
  it('窄容器維持可讀文字、寬幅比例與完整座標刻度', () => {
    const compact = getSearchRewardChartDimensions(360);
    const mobile = getSearchRewardChartDimensions(320);
    const wideMobile = getSearchRewardChartDimensions(400);
    const desktop = getSearchRewardChartDimensions(960);

    expect(compact).toMatchObject({
      width: 360,
      height: 220,
      left: 44,
      right: 8,
      top: 24,
      bottom: 44,
    });
    expect(desktop).toMatchObject({
      width: 960,
      height: 400,
      left: 48,
      right: 12,
      top: 30,
      bottom: 62,
    });
    expect(mobile).toMatchObject({ width: 320, height: 210 });
    expect(wideMobile).toMatchObject({ width: 400, height: 230 });
    expect(compact.width - compact.left - compact.right).toBeGreaterThan(300);
    expect(desktop.width - desktop.left - desktop.right).toBeGreaterThan(868);
    expect(compact.left - chartYAxisTickGap).toBeGreaterThanOrEqual(
      chartYAxisTickLabelReserve,
    );
    expect(estimateChartTickLabelWidth(
      formatChartAxisTick(createNumberFormatter('en'), -999.9),
    )).toBeLessThanOrEqual(compact.left - chartYAxisTickGap);
  });

  it('提供收益／產量切換、階梯點標記與單一可存取圖表鍵盤入口', () => {
    const markup = renderChartMarkup();
    const parsed = document.createElement('div');
    parsed.innerHTML = markup;
    const chartSvgContainer = parsed.querySelector('[data-chart-metric]');
    const chartRegion = parsed.querySelector('[data-chart-region]');
    const chartSvg = chartSvgContainer?.querySelector('svg');
    const cardContent = parsed.querySelector(
      '[data-search-reward-chart] > div > div:last-child',
    );
    const cardHeader = parsed.querySelector(
      '[data-search-reward-chart] > div > div:first-child',
    );

    expect(markup).toContain('data-search-reward-chart="true"');
    expect(cardHeader?.className).toContain('px-3');
    expect(cardHeader?.className).toContain('sm:px-6');
    expect(cardContent?.className).toContain('px-3');
    expect(cardContent?.className).toContain('sm:px-6');
    expect(chartRegion?.getAttribute('role')).toBe('region');
    expect(chartRegion?.className).not.toContain('overflow-x-auto');
    expect(chartRegion?.hasAttribute('tabindex')).toBe(false);
    expect(chartSvgContainer?.className).not.toContain('min-w-[40rem]');
    expect(markup).toContain('role="group"');
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('各類物品預期產出數量');
    expect(markup).toContain('預期收益');
    expect(markup).toContain('收益階梯點');
    expect(chartSvg?.querySelectorAll('[role="button"]')).toHaveLength(0);
    expect(markup).toContain('tabindex="0"');
    expect((markup.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect(chartSvg?.getAttribute('tabindex')).toBe('0');
    expect(chartSvg?.getAttribute('role')).toBe('group');
    expect(chartSvg?.getAttribute('class')).toContain('focus-visible:ring');
    expect(chartSvg?.querySelectorAll('circle[tabindex], circle[role]')).toHaveLength(0);
    expect(markup).toContain('search-reward-chart-active-point-description');
    expect(markup).toContain('data-ladder-point="true"');
    expect(markup).not.toContain('ladder-point-line');
    expect(chartSvg?.querySelectorAll('[data-search-reward-chart-hover-callout]')).toHaveLength(0);
    const selectedPoint = chartSvg?.querySelector('[data-selected-point]');
    expect(selectedPoint?.querySelectorAll('line')).toHaveLength(1);
    expect(selectedPoint?.querySelector('line')?.getAttribute('x1'))
      .toBe(selectedPoint?.querySelector('line')?.getAttribute('x2'));
    expect(chartSvg?.querySelectorAll('[data-chart-y-gridline="true"]')).toHaveLength(5);
    expect(chartSvgContainer?.querySelector('svg')?.tagName.toLowerCase()).toBe('svg');
    expect(chartSvg?.getAttribute('data-chart-width')).toBe('960');
    expect(chartSvg?.getAttribute('data-chart-tick-count')).toBe('5');
    expect(chartSvg?.getAttribute('data-chart-y-tick-count')).toBe('5');
    expect(chartSvg?.getAttribute('data-chart-x-min')).toBe('1');
    expect(chartSvg?.getAttribute('data-chart-x-max')).toBe('797');
    expect(chartSvg?.getAttribute('style')).toContain('pan-y pinch-zoom');
    expect(markup).toContain('data-chart-viewport-controls="true"');
    expect(chartSvgContainer?.querySelector('[data-chart-viewport-slider]')?.getAttribute('type'))
      .toBe('range');
    expect((chartSvgContainer?.querySelector('[data-chart-viewport-slider]') as HTMLInputElement | null)
      ?.disabled).toBe(true);
    expect(chartSvgContainer?.querySelector('[data-chart-visible-range]')?.textContent)
      .toContain('目前可見等級範圍: 1–797');
    expect(markup).toContain('aria-label="放大圖表"');
    expect(markup).toContain('size-11');
    const xTickLabels = chartSvgContainer?.querySelectorAll('[data-chart-axis-tick="x"]') ?? [];
    expect(xTickLabels[0]?.getAttribute('text-anchor')).toBe('start');
    expect(xTickLabels[xTickLabels.length - 1]?.getAttribute('text-anchor')).toBe('end');
    expect(chartSvgContainer?.querySelector('[data-chart-axis="y"]')?.textContent)
      .toBe('預期收益（AI／批）');
    expect(chartSvgContainer?.querySelector('[data-chart-axis="y"]')?.hasAttribute('transform'))
      .toBe(false);
    expect(chartSvgContainer?.querySelector('[data-current-level-label]')?.textContent)
      .toBe('目前等級');
    expect(markup).not.toContain('查看完整資料表');
    expect(markup).not.toContain('<table');
    expect(markup).not.toContain('高收益區');
    expect(markup).not.toContain('weighted');
    expect(markup).toMatch(/d="M [^\"]+ L [^\"]+/);
  });

  it('各語系的縱軸標籤都包含對應的批次單位', () => {
    const expectations = [
      {
        locale: 'zh-tw' as const,
        value: '預期收益（AI／批）',
        quantity: '預期產出數量（個／批）',
        zoomIn: '放大圖表',
      },
      {
        locale: 'zh-cn' as const,
        value: '预期收益（AI／批）',
        quantity: '预期产出数量（个／批）',
        zoomIn: '放大图表',
      },
      {
        locale: 'en' as const,
        value: 'Expected value (AI / batch)',
        quantity: 'Expected output quantity (items / batch)',
        zoomIn: 'Zoom in',
      },
    ];

    for (const expectation of expectations) {
      const labels = getMessages(expectation.locale).tools.searchReward;
      const markup = renderChartMarkup(expectation.locale);

      expect(labels.chartAxisValue).toBe(expectation.value);
      expect(labels.chartAxisQuantity).toBe(expectation.quantity);
      expect(markup).toContain(expectation.value);
      expect(markup).toContain(`aria-label="${expectation.zoomIn}"`);
    }
  });

  it('切換產量模式時保留目前等級提示但移除收益階梯視覺與圖例', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardChart labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const chart = container.querySelector('[data-search-reward-chart]');
    const svg = () => chart?.querySelector('svg');
    const yAxisLabel = () => svg()?.querySelector('[data-chart-axis="y"]')?.textContent;
    const legend = () => chart?.querySelector('ul[aria-label="圖例"]')?.textContent;
    const quantityRadio = chart?.querySelector<HTMLInputElement>(
      '#search-reward-chart-metric-quantity',
    );
    const valueRadio = chart?.querySelector<HTMLInputElement>('#search-reward-chart-metric-value');

    expect(yAxisLabel()).toBe('預期收益（AI／批）');
    expect(svg()?.querySelectorAll('[data-ladder-point="true"]').length).toBeGreaterThan(0);
    expect(svg()?.querySelectorAll('line[stroke="var(--cco-color-warning)"]').length)
      .toBe(0);
    expect(legend()).toContain('收益階梯點');

    await act(async () => {
      quantityRadio?.click();
      await Promise.resolve();
    });

    expect(yAxisLabel()).toBe('預期產出數量（個／批）');
    expect(svg()?.querySelectorAll('[data-ladder-point="true"]')).toHaveLength(0);
    expect(svg()?.querySelectorAll('line[stroke="var(--cco-color-warning)"]')).toHaveLength(0);
    expect(legend()).not.toContain('收益階梯點');
    expect(legend()).toContain('目前等級');

    await act(async () => {
      valueRadio?.click();
      await Promise.resolve();
    });

    expect(yAxisLabel()).toBe('預期收益（AI／批）');
    expect(svg()?.querySelectorAll('[data-ladder-point="true"]').length).toBeGreaterThan(0);
    expect(legend()).toContain('收益階梯點');

    await act(async () => root.unmount());
    store.dispose();
  });

  it('依繁中、簡中與英文顯示水平位置及可見範圍標籤', () => {
    const labels = [
      { locale: 'zh-tw' as const, position: '水平位置', visible: '目前可見等級範圍' },
      { locale: 'zh-cn' as const, position: '水平位置', visible: '当前可见等级范围' },
      { locale: 'en' as const, position: 'Horizontal position', visible: 'Visible levels' },
    ];

    for (const expected of labels) {
      const parsed = document.createElement('div');
      parsed.innerHTML = renderChartMarkup(expected.locale);
      const slider = parsed.querySelector('[data-chart-viewport-slider]');

      expect(slider?.getAttribute('aria-label')).toBe(expected.position);
      expect(slider?.getAttribute('aria-valuetext')).toContain(expected.visible);
      expect(parsed.querySelector('[data-chart-visible-range]')?.textContent)
        .toContain(expected.visible);
    }
  });

  it('選取明細的數值最多顯示兩位小數', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const numberFormatter = (value: number, options?: Intl.NumberFormatOptions) =>
      value.toFixed(options?.maximumFractionDigits ?? 0);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardChart
              labels={getMessages('zh-tw').tools.searchReward}
              locale="zh-tw"
              numberFormatter={numberFormatter}
            />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const details = container.querySelector('[data-selected-point-details]');
    const summary = details?.querySelector('[data-point-details-summary]');
    const output = details?.querySelector('[data-point-details-output]');
    expect(details).not.toBeNull();
    expect(details?.className).toContain('@container');
    expect(summary?.className).toContain('@min-[24rem]:grid-cols-2');
    expect(summary?.textContent).toContain('搜索等級');
    expect(summary?.textContent).toContain('預估收益');
    expect(summary?.children[1]?.className).toContain('items-baseline');
    expect(summary?.children[1]?.className).not.toContain('justify-self-end');
    expect(output?.className).toContain('@min-[36rem]:grid-cols-3');
    expect(output?.className).toContain('border-t border-border');
    expect(output?.children).toHaveLength(3);
    expect(details?.textContent).not.toMatch(/\d+\.\d{3,}/);
    expect(details?.textContent).toMatch(/\d+\.\d{2}/);

    await act(async () => root.unmount());
    store.dispose();
  });

  it('靠近曲線才顯示系列 callout；收益帶單位，產量各線顯示名稱與數值', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardChart labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const svg = container.querySelector<SVGSVGElement>('[data-chart-metric] svg')!;
    const details = () => container.querySelector('[data-selected-point-details]')?.textContent ?? '';
    const callout = () => svg.querySelector<SVGGElement>(
      '[data-search-reward-chart-hover-callout="true"]',
    );
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 960, height: 400 }),
    });

    expect(callout()).toBeNull();
    const valuePoint = getSeriesPoint(svg, 'value', 120)!;
    await act(async () => dispatchPointerMove(svg, valuePoint));
    expect(callout()?.getAttribute('data-search-reward-chart-hover-series')).toBe('value');
    expect(callout()?.textContent).toContain('預估收益');
    expect(callout()?.textContent).toContain('AI／批');
    expect(callout()?.textContent).toMatch(/\d/);
    expect(svg.querySelectorAll('[data-selected-point] circle')).toHaveLength(1);
    const valueCalloutRect = callout()?.querySelector('rect');
    const valueCalloutBounds = {
      x: Number(valueCalloutRect?.getAttribute('x')),
      y: Number(valueCalloutRect?.getAttribute('y')),
      width: Number(valueCalloutRect?.getAttribute('width')),
      height: Number(valueCalloutRect?.getAttribute('height')),
    };
    expect(valueCalloutBounds.x).toBeGreaterThanOrEqual(48);
    expect(valueCalloutBounds.x + valueCalloutBounds.width).toBeLessThanOrEqual(948);
    expect(valueCalloutBounds.y).toBeGreaterThanOrEqual(30);
    expect(valueCalloutBounds.y + valueCalloutBounds.height).toBeLessThanOrEqual(338);

    const previewDetails = details();
    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    expect(callout()).toBeNull();
    expect(details()).toBe(previewDetails);

    const quantityRadio = container.querySelector<HTMLInputElement>(
      '#search-reward-chart-metric-quantity',
    );
    await act(async () => {
      quantityRadio?.click();
      await Promise.resolve();
    });

    const labels = getMessages('zh-tw').tools.searchReward;
    const expectedLabels = {
      medical: labels.medicalParts,
      ammo: labels.ammoParts,
      military: labels.militaryAmmoParts,
    } as const;
    for (const seriesId of quantitySeriesIds) {
      const point = getDistinctSeriesPoint(svg, seriesId);
      expect(point).not.toBeNull();
      await act(async () => dispatchPointerMove(svg, point!));
      expect(callout()?.getAttribute('data-search-reward-chart-hover-series')).toBe(seriesId);
      expect(callout()?.textContent).toContain(expectedLabels[seriesId]);
      expect(callout()?.textContent).toMatch(/\d/);
    }

    await act(async () => root.unmount());
    store.dispose();
  });

  it('整張 SVG 是唯一資料圖表焦點；方向鍵移動、Enter pin、Escape 清除', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardChart labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const chart = container.querySelector('[data-search-reward-chart]');
    const svg = chart?.querySelector<SVGSVGElement>('svg');
    const details = () => chart?.querySelector('[data-selected-point-details]')?.textContent ?? '';
    expect(svg?.getAttribute('tabindex')).toBe('0');
    expect(svg?.querySelectorAll('[role="button"], circle[tabindex]')).toHaveLength(0);
    expect(details()).toContain('Lv.1 地區');

    await act(async () => svg?.focus());
    expect(document.activeElement).toBe(svg);
    await act(async () => {
      svg?.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowRight',
      }));
    });
    expect(details()).toContain('Lv.4 地區');

    await act(async () => {
      svg?.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
      }));
      svg?.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'ArrowLeft',
      }));
    });
    expect(details()).toContain('Lv.1 地區');

    await act(async () => svg?.blur());
    expect(details()).toContain('Lv.4 地區');
    await act(async () => svg?.focus());
    await act(async () => {
      svg?.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape',
      }));
    });
    expect(details()).toContain('Lv.1 地區');

    await act(async () => root.unmount());
    store.dispose();
  });

  it('離開時保留最後檢視或恢復 pin，觸控拖曳與取消不會誤鎖定', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardChart labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
    });

    const svg = container.querySelector<SVGSVGElement>('svg[data-chart-width]')!;
    const details = () => container.querySelector('[data-selected-point-details]')?.textContent ?? '';
    const initialDetails = details();
    const xAt = (index: number) => getSeriesPoint(svg, 'value', index)!.x;
    const clickAt = (x: number, y: number) => svg.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      detail: 1,
      clientX: x,
      clientY: y,
    }));
    const line = container.querySelector('[data-current-level-line]');
    const currentLevelX = line?.getAttribute('x1');
    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 960, height: 400 }),
    });

    const dispatchTouchPointer = (
      type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
      x: number,
      y: number,
      pointerId = 17,
    ) => svg.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      pointerId,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: y,
    }));

    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: xAt(180),
        clientY: 120,
      }));
      svg.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    const lastPreview = details();
    expect(lastPreview).not.toBe(initialDetails);
    expect(line?.getAttribute('x1')).toBe(currentLevelX);

    await act(async () => {
      dispatchTouchPointer('pointerdown', xAt(180), 120);
      dispatchTouchPointer('pointermove', xAt(130), 145);
      dispatchTouchPointer('pointerup', xAt(130), 145);
      clickAt(xAt(130), 145);
    });
    const dragPreview = details();
    expect(dragPreview).not.toBe(initialDetails);

    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: xAt(50),
        clientY: 120,
      }));
      svg.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    const previewAfterDrag = details();
    expect(previewAfterDrag).not.toBe(dragPreview);
    await act(async () => {
      dispatchTouchPointer('pointerdown', xAt(50), 120, 18);
      dispatchTouchPointer('pointermove', xAt(80), 130, 18);
      dispatchTouchPointer('pointercancel', xAt(80), 130, 18);
      clickAt(xAt(80), 130);
    });
    const cancelledTouchPreview = details();
    expect(cancelledTouchPreview).not.toBe(previewAfterDrag);
    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: xAt(50),
        clientY: 120,
      }));
      svg.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    expect(details()).toBe(previewAfterDrag);

    await act(async () => {
      dispatchTouchPointer('pointerdown', xAt(70), 120, 19);
      dispatchTouchPointer('pointerup', xAt(70), 120, 19);
      clickAt(xAt(70), 120);
    });
    const pinnedDetails = details();

    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: xAt(20),
        clientY: 120,
      }));
      svg.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
    });
    expect(details()).toBe(pinnedDetails);
    await act(async () => {
      svg.focus();
      svg.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape',
      }));
    });
    expect(details()).toBe(initialDetails);

    await act(async () => root.unmount());
    store.dispose();
  });

  it('slider 可移至兩端並重設，圖內拖曳不平移且點選仍可選取定位線', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardChart labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
    });

    const svg = container.querySelector<SVGSVGElement>('[data-chart-metric] svg')!;
    const zoomButton = container.querySelector<HTMLButtonElement>(
      '[data-chart-viewport-action="zoom-in"]',
    )!;
    const resetButton = container.querySelector<HTMLButtonElement>(
      '[data-chart-viewport-action="reset"]',
    )!;
    const slider = container.querySelector<HTMLInputElement>('[data-chart-viewport-slider]')!;
    const initialYDomain = [svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')];
    expect(slider.disabled).toBe(true);

    await act(async () => zoomButton.click());
    const zoomedMin = Number(svg.getAttribute('data-chart-x-min'));
    const zoomedMax = Number(svg.getAttribute('data-chart-x-max'));
    const zoomedSpan = zoomedMax - zoomedMin;
    expect(slider.disabled).toBe(false);
    expect(zoomedMax - zoomedMin).toBeLessThan(796);
    expect(svg.getAttribute('data-chart-tick-count')).toBe('5');
    expect(svg.getAttribute('data-chart-y-tick-count')).toBe('5');
    expect([svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')])
      .toEqual(initialYDomain);

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
    const rightEdgeMin = Number(svg.getAttribute('data-chart-x-min'));
    expect(Number(svg.getAttribute('data-chart-x-max'))).toBe(797);
    expect(rightEdgeMin).toBeCloseTo(797 - zoomedSpan);
    expect(Number(slider.value)).toBe(Number(slider.max));
    expect([svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')])
      .toEqual(initialYDomain);

    await setSliderValue(Math.round(Number(slider.max) / 2));
    const centeredMin = Number(svg.getAttribute('data-chart-x-min'));
    const centeredMax = Number(svg.getAttribute('data-chart-x-max'));
    expect(centeredMin).toBeGreaterThan(1);
    expect(centeredMax).toBeLessThan(797);
    expect(centeredMax - centeredMin).toBeCloseTo(zoomedSpan);

    Object.defineProperty(svg, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 960, height: 400 }),
    });
    await act(async () => {
      svg.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerId: 7,
        isPrimary: true,
        button: 0,
        clientX: 550,
        clientY: 160,
      }));
      svg.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        pointerId: 7,
        isPrimary: true,
        clientX: 430,
        clientY: 160,
      }));
      svg.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        pointerId: 7,
        isPrimary: true,
        clientX: 430,
        clientY: 160,
      }));
    });
    expect(Number(svg.getAttribute('data-chart-x-min'))).toBe(centeredMin);
    expect(Number(svg.getAttribute('data-chart-x-max'))).toBe(centeredMax);

    await act(async () => {
      svg.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Escape',
      }));
    });
    await act(async () => svg.focus());
    const focusedMin = Number(svg.getAttribute('data-chart-x-min'));
    const focusedMax = Number(svg.getAttribute('data-chart-x-max'));
    expect(focusedMin).toBe(1);
    expect(focusedMax).toBeGreaterThanOrEqual(1);
    expect(focusedMax - focusedMin).toBeCloseTo(zoomedSpan);
    expect([svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')])
      .toEqual(initialYDomain);

    const detailsBeforeClick = container.querySelector('[data-selected-point-details]')?.textContent;
    await act(async () => {
      svg.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        detail: 1,
        clientX: 500,
        clientY: 160,
      }));
    });
    expect(container.querySelector('[data-selected-point-details]')?.textContent)
      .not.toBe(detailsBeforeClick);

    await act(async () => resetButton.click());
    expect(svg.getAttribute('data-chart-x-min')).toBe('1');
    expect(svg.getAttribute('data-chart-x-max')).toBe('797');
    expect(slider.disabled).toBe(true);
    expect(container.querySelector('[data-chart-visible-range]')?.textContent)
      .toContain('目前可見等級範圍: 1–797');

    await act(async () => root.unmount());
    store.dispose();
  });

  it('跟隨搜索次數輸入更新可存取資料點數值', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardCalculator labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
            <SearchRewardChart labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const chart = container.querySelector('[data-search-reward-chart]');
    const activePointDescription = () => chart?.querySelector(
      '#search-reward-chart-active-point-description',
    )?.textContent;
    const initialDescription = activePointDescription();
    const input = container.querySelector('#search-reward-count') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(initialDescription).toContain('預估收益');

    await act(async () => {
      if (!input) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, '2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    expect(activePointDescription()).not.toBe(initialDescription);

    await act(async () => root.unmount());
    store.dispose();
  });

  it('目前等級定位線與標籤會跟隨玩家搜索等級移動', async () => {
    const store = createSharedUserInputsStore({ storage: null });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <SearchRewardToolProvider>
            <SearchRewardCalculator labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
            <SearchRewardChart labels={getMessages('zh-tw').tools.searchReward} locale="zh-tw" />
          </SearchRewardToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const line = () => container.querySelector('[data-current-level-line]');
    const markerLabel = () => container.querySelector('[data-current-level-label]');
    const initialLineX = line()?.getAttribute('x1');
    const initialLabelX = markerLabel()?.getAttribute('x');
    const input = container.querySelector('#search-reward-player-level') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    await act(async () => {
      if (!input) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, '400');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    expect(line()?.getAttribute('x1')).not.toBe(initialLineX);
    expect(line()?.getAttribute('x1')).toBe(line()?.getAttribute('x2'));
    expect(markerLabel()?.getAttribute('x')).not.toBe(initialLabelX);
    expect(markerLabel()?.textContent).toBe('目前等級');

    await act(async () => root.unmount());
    store.dispose();
  });
});
