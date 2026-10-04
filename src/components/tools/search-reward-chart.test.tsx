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

afterEach(() => {
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe('Search Reward chart UI', () => {
  it('窄容器維持可讀文字、寬幅比例與完整座標刻度', () => {
    const compact = getSearchRewardChartDimensions(360);
    const mobile = getSearchRewardChartDimensions(320);
    const desktop = getSearchRewardChartDimensions(960);

    expect(compact).toMatchObject({
      width: 360,
      height: 180,
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
    expect(mobile).toMatchObject({ width: 320, height: 160 });
    expect(compact.width - compact.left - compact.right).toBeGreaterThan(300);
    expect(desktop.width - desktop.left - desktop.right).toBeGreaterThan(868);
    expect(compact.left - chartYAxisTickGap).toBeGreaterThanOrEqual(
      chartYAxisTickLabelReserve,
    );
    expect(estimateChartTickLabelWidth(
      formatChartAxisTick(createNumberFormatter('en'), -999.9),
    )).toBeLessThanOrEqual(compact.left - chartYAxisTickGap);
  });

  it('提供收益／產量切換、實際資料點、階梯點標記與可存取互動目標', () => {
    const markup = renderChartMarkup();
    const parsed = document.createElement('div');
    parsed.innerHTML = markup;
    const chartSvgContainer = parsed.querySelector('[data-chart-metric]');
    const chartRegion = parsed.querySelector('[data-chart-region]');
    const chartSvg = chartSvgContainer?.querySelector('svg');

    expect(markup).toContain('data-search-reward-chart="true"');
    expect(chartRegion?.getAttribute('role')).toBe('region');
    expect(chartRegion?.className).not.toContain('overflow-x-auto');
    expect(chartRegion?.hasAttribute('tabindex')).toBe(false);
    expect(chartSvgContainer?.className).not.toContain('min-w-[40rem]');
    expect(markup).toContain('role="group"');
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('各類物品預期產出數量');
    expect(markup).toContain('預期收益');
    expect(markup).toContain('收益階梯點');
    expect(markup).toContain('role="button"');
    expect(markup).toContain('tabindex="0"');
    expect((markup.match(/tabindex="0"/g) ?? []).length).toBe(1);
    expect(chartSvgContainer?.querySelectorAll('[role="button"][tabindex="0"]')).toHaveLength(1);
    expect(markup).toContain('aria-label="Lv.1 地區');
    expect(markup).toContain('data-ladder-point="true"');
    expect(markup).not.toContain('ladder-point-line');
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

  it('hover、focus、click 與左右方向鍵可選取及移動資料點', async () => {
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
    const targets = chart?.querySelectorAll('[role="button"]');
    expect(targets?.length).toBe(240);
    const tabStops = Array.from(targets ?? []).filter(
      (target) => target.getAttribute('tabindex') === '0',
    );
    expect(tabStops).toHaveLength(1);
    const first = targets?.[0] as SVGCircleElement | undefined;
    const second = targets?.[1] as SVGCircleElement | undefined;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.getAttribute('tabindex')).toBe('0');
    expect(first?.getAttribute('aria-pressed')).toBe('false');
    expect(chart?.querySelector('[data-selected-point-details]')?.textContent).toContain('Lv.1 地區');

    await act(async () => {
      first?.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    });
    expect(chart?.querySelector('[data-selected-point-details]')?.textContent).toContain('Lv.1 地區');

    await act(async () => {
      first?.focus();
    });
    expect(first?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      first?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(first?.getAttribute('aria-pressed')).toBe('true');
    expect(second?.getAttribute('aria-pressed')).toBe('false');
    expect(first?.getAttribute('tabindex')).toBe('-1');
    expect(second?.getAttribute('tabindex')).toBe('0');
    expect(chart?.querySelector('[data-selected-point-details]')?.textContent).toContain('Lv.4 地區');

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

    const firstPoint = svg.querySelector<SVGCircleElement>('circle[role="button"]')!;
    await act(async () => firstPoint.focus());
    const focusedMin = Number(svg.getAttribute('data-chart-x-min'));
    const focusedMax = Number(svg.getAttribute('data-chart-x-max'));
    expect(focusedMin).toBe(1);
    expect(focusedMax).toBeGreaterThanOrEqual(1);
    expect(focusedMax - focusedMin).toBeCloseTo(zoomedSpan);
    expect([svg.getAttribute('data-chart-y-min'), svg.getAttribute('data-chart-y-max')])
      .toEqual(initialYDomain);

    await act(async () => {
      svg.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        detail: 1,
        clientX: 500,
        clientY: 160,
      }));
    });
    expect(container.querySelectorAll('[role="button"][aria-pressed="true"]')).toHaveLength(1);

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
    const first = chart?.querySelector('[role="button"]') as SVGCircleElement | null;
    const initialLabel = first?.getAttribute('aria-label');
    const input = container.querySelector('#search-reward-count') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(initialLabel).toContain('預估收益');

    await act(async () => {
      if (!input) return;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      valueSetter?.call(input, '2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await Promise.resolve();
    });

    expect(first?.getAttribute('aria-label')).not.toBe(initialLabel);

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
