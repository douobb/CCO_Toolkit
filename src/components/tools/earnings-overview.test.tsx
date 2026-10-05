// @vitest-environment happy-dom

import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createNumberFormatter } from '@/lib/number-formatting';
import type { EarningsComparisonMode } from '@/lib/earnings-calculator';
import {
  calculateManualMixedCrushing,
  calculateRecommendedMixedCrushing,
  getMixedCrushingComparisonValue,
} from '@/lib/mixed-crushing-calculator';
import {
  createSharedUserInputsStore,
  defaultSharedUserInputs,
  loadToolState,
  saveToolState,
} from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  mixedCrushingUiLabels,
} from './mixed-crushing-labels';
import {
  calculateEarningsOverviewTool,
  applyEarningsOverviewSharedValues,
  EarningsOverviewCalculator,
  EarningsOverviewResultTable,
  EarningsOverviewToolProvider,
    normalizeEarningsOverviewToolState,
  parseEarningsOverviewValues,
  selectEarningsOverviewSharedValues,
} from './earnings-overview';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface MountedOverview {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
}

const mountedOverviews: MountedOverview[] = [];

function renderEarningsOverview(children: ReactNode) {
  const store = createSharedUserInputsStore({ storage: null });
  const markup = renderToStaticMarkup(
    <SharedUserInputsProvider store={store}>
      <EarningsOverviewToolProvider>{children}</EarningsOverviewToolProvider>
    </SharedUserInputsProvider>,
  );
  store.dispose();
  return markup;
}

function setNumberInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 number input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 select value setter');
  setter.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

async function mountInteractiveOverview() {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  const root = createRoot(container);
  mountedOverviews.push({ container, root, store });

  await act(async () => {
    root.render(
      <SharedUserInputsProvider store={store}>
        <EarningsOverviewToolProvider>
          <EarningsOverviewCalculator
            labels={getMessages('zh-tw').tools.earningsOverview}
            locale="zh-tw"
            closeLabel={getMessages('zh-tw').context.closePanel}
          />
        </EarningsOverviewToolProvider>
      </SharedUserInputsProvider>,
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return container;
}

function createTrackedRoot() {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  const root = createRoot(container);
  mountedOverviews.push({ container, root, store });
  return { container, root };
}

async function setMixedCount(
  container: HTMLElement,
  type: 'medical' | 'ammunition' | 'military',
  value: string,
) {
  const input = container.querySelector<HTMLInputElement>(
    `[data-mixed-crushing-number="${type}"]`,
  );
  if (!input) throw new Error(`找不到 ${type} 混合壓碎輸入欄`);
  await act(async () => {
    setNumberInputValue(input, value);
    await Promise.resolve();
  });
}

async function setComparisonMode(container: HTMLElement, mode: EarningsComparisonMode) {
  const select = container.querySelector<HTMLSelectElement>(
    '#earnings-overview-comparison-mode',
  );
  if (!select) throw new Error('找不到收益總覽比較方式選單');
  await act(async () => {
    setSelectValue(select, mode);
    await Promise.resolve();
  });
}

async function activateFixedChart(container: HTMLElement) {
  const labels = getMessages('zh-tw').tools.earningsOverview;
  const fixedTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    .find((candidate) => candidate.textContent === labels.trendGroupFixed);
  if (!fixedTab) throw new Error('找不到固定收益圖表分頁');
  await act(async () => fixedTab.click());
}

function expectRecommendedView(container: HTMLElement, mode: EarningsComparisonMode) {
  const labels = getMessages('zh-tw').tools.earningsOverview;
  const calculation = calculateEarningsOverviewTool({
    searchLevel: '1',
    printingLevel: '1',
    miningLevel: '1',
    bargainPercent: '0',
    btcBuffPercent: '100',
    comparisonMode: mode,
  });
  if (!calculation.result) throw new Error(`無法計算 ${mode} 測試結果`);
  const expected = calculateRecommendedMixedCrushing(calculation.result);
  if (!expected) throw new Error(`無法計算 ${mode} 混合壓碎推薦`);

  const formatter = createNumberFormatter('zh-tw');
  const controls = container.querySelector<HTMLElement>('[data-mixed-crushing-controls]');
  expect(controls?.getAttribute('data-mixed-crushing-mode')).toBe('recommended');
  expect(container.querySelector('[data-mixed-crushing-validation]')).toBeNull();

  for (const type of ['medical', 'ammunition', 'military'] as const) {
    const numberInput = container.querySelector<HTMLInputElement>(
      `[data-mixed-crushing-number="${type}"]`,
    );
    const slider = container.querySelector<HTMLInputElement>(
      `[data-mixed-crushing-slider="${type}"]`,
    );
    expect(numberInput?.value).toBe(String(expected.counts[type]));
    expect(slider?.value).toBe(String(expected.counts[type]));
  }

  const row = container.querySelector<HTMLElement>('[data-earnings-overview-mixed-crushing]');
  const expectedComposition = [
    `${mixedCrushingUiLabels['zh-tw'].medical} ${formatter(expected.counts.medical, {
      maximumFractionDigits: 0,
    })} ${mixedCrushingUiLabels['zh-tw'].itemUnit}`,
    `${mixedCrushingUiLabels['zh-tw'].ammunition} ${formatter(expected.counts.ammunition, {
      maximumFractionDigits: 0,
    })} ${mixedCrushingUiLabels['zh-tw'].itemUnit}`,
    `${mixedCrushingUiLabels['zh-tw'].military} ${formatter(expected.counts.military, {
      maximumFractionDigits: 0,
    })} ${mixedCrushingUiLabels['zh-tw'].itemUnit}`,
  ].join(' · ');
  expect(row?.textContent).toContain(mixedCrushingUiLabels['zh-tw'].recommended);
  expect(row?.textContent).toContain(expectedComposition);
  if (expected.totalNetAi !== null) {
    expect(row?.textContent).toContain(formatter(expected.totalNetAi, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
  }
  if (mode === 'per-minute' && expected.aiPerMinute !== null) {
    expect(row?.textContent).toContain(formatter(expected.aiPerMinute, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));
  }

  const comparisonValue = getMixedCrushingComparisonValue(expected, mode);
  const expectedChartValue = comparisonValue === null
    ? labels.notAvailable
    : `${formatter(comparisonValue, { maximumFractionDigits: 2 })} ${labels.aiUnit}`;
  expect(container.querySelector<HTMLElement>(
    '[data-earnings-chart-fixed-value="crush-mixed"]',
  )?.textContent).toBe(expectedChartValue);
}

afterEach(async () => {
  for (const mounted of mountedOverviews.splice(0)) {
    await act(async () => mounted.root.unmount());
    mounted.store.dispose();
    mounted.container.remove();
  }
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe('Earnings overview calculator', () => {
  it('呈現共用輸入、混合壓碎控制與 17 筆活動', () => {
    const labels = getMessages('zh-tw').tools.earningsOverview;
    const markup = renderEarningsOverview(
      <EarningsOverviewCalculator
        labels={labels}
        locale="zh-tw"
        closeLabel={getMessages('zh-tw').context.closePanel}
      />,
    );

    expect(markup).toContain('data-tool="earnings-overview"');
    expect(markup).toContain('id="earnings-overview-search-level"');
    expect(markup).toContain('id="earnings-overview-printing-level"');
    expect(markup).toContain('id="earnings-overview-mining-level"');
    expect(markup).toContain('id="earnings-overview-bargain-percent"');
    expect(markup).toContain('id="earnings-overview-btc-buff-percent"');
    expect(markup).toContain('aria-valuenow="100"');
    expect(markup).toContain('id="earnings-overview-comparison-mode"');
    expect(markup).toContain('比較方式');
    expect(markup).toContain('15 分鐘飛逝');
    expect(markup).toContain('data-result-layout="table"');
    expect(markup).toContain('data-earnings-overview-table="true"');
    expect(markup).toContain('data-comparison-mode="per-minute"');
    expect(markup).toContain('data-earnings-chart="true"');
    expect(markup).toContain('min-w-[40rem]');
    expect(markup).toContain('<col class="w-[31%]"/>');
    expect(markup.match(/<tr/g)).toHaveLength(18);
    expect(markup).toContain('data-mixed-crushing-controls="true"');
    expect(markup).toContain('data-earnings-overview-mixed-crushing="true"');
    expect(markup).toContain('data-mixed-crushing-details-trigger="true"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('data-mixed-crushing-details-toggle');
    expect(markup).not.toContain('data-mixed-crushing-details="true"');
    expect(markup).toContain('data-mixed-crushing-number="medical"');
    expect(markup).toContain('data-mixed-crushing-number="ammunition"');
    expect(markup).toContain('data-mixed-crushing-number="military"');
    expect(markup.match(/data-mixed-crushing-slider=/g)).toHaveLength(3);
    expect(markup).toContain('推薦組合');
    expect(markup).toContain('活動收益');
    expect(markup).toContain('從共用設定填入');
    expect(markup).not.toContain('重設本工具');
  });

  it('由穩定設定 ID 投影共用等級，但不讀取 Shared Buff', () => {
    const snapshot = {
      ...defaultSharedUserInputs,
      progression: {
        ...defaultSharedUserInputs.progression,
        player: { level: 500 },
        skills: [
          { id: 'printing-rank' as const, level: 450 },
          { id: 'mining-skill' as const, level: 420 },
        ],
      },
      effects: {
        buffs: [{ id: 'btc-buff-percent' as const, percentage: 80 as const }],
      },
      equipment: { bargainPercent: 40 },
    };

    expect(selectEarningsOverviewSharedValues(snapshot)).toEqual({
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
    });
  });

  it('缺少 Buff 欄位時預設 100，既有值保留且填入共用設定不覆蓋 Buff', () => {
    const missingBuff = {
      searchLevel: '1',
      printingLevel: '1',
      miningLevel: '1',
      bargainPercent: '0',
    };
    expect(normalizeEarningsOverviewToolState(missingBuff)).toMatchObject({
      ...missingBuff,
      btcBuffPercent: '100',
      comparisonMode: 'per-minute',
    });
    expect(normalizeEarningsOverviewToolState({ ...missingBuff, btcBuffPercent: '100' }))
      .toMatchObject({ btcBuffPercent: '100' });

    const current = normalizeEarningsOverviewToolState({
      ...missingBuff,
      btcBuffPercent: '40',
    })!;
    expect(applyEarningsOverviewSharedValues(
      current,
      selectEarningsOverviewSharedValues(defaultSharedUserInputs),
    ).btcBuffPercent).toBe('40');
  });

  it('拒絕非整數或超出範圍的值，合法輸入可產生活動結果', () => {
    const values = {
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
    } as const;

    expect(parseEarningsOverviewValues({ ...values, searchLevel: '500.5' }).inputs).toBeNull();
    expect(parseEarningsOverviewValues({ ...values, bargainPercent: '41' }).inputs).toBeNull();
    expect(calculateEarningsOverviewTool(values).result?.activities).toHaveLength(16);
  });

  it('相容舊版五欄狀態並補上每分鐘比較方式', () => {
    const legacyValues = {
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
    };
    const originalValues = { ...legacyValues };

    expect(normalizeEarningsOverviewToolState(legacyValues)).toEqual({
      ...legacyValues,
      comparisonMode: 'per-minute',
      mixedCrushingMode: 'recommended',
      mixedMedicalCount: '0',
      mixedAmmunitionCount: '0',
      mixedMilitaryCount: '0',
    });
    expect(legacyValues).toEqual(originalValues);
  });

  it('依比較方式切換飛逝模式的動態欄位', () => {
    const values = {
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
      comparisonMode: 'elapsed-15' as const,
    };
    const calculation = calculateEarningsOverviewTool(values);
    const labels = getMessages('zh-tw').tools.earningsOverview;
    const markup = renderToStaticMarkup(
      <EarningsOverviewResultTable
        labels={labels}
        locale="zh-tw"
        closeLabel={getMessages('zh-tw').context.closePanel}
        result={calculation.result!}
        formatNumber={createNumberFormatter('zh-tw')}
      />,
    );

    expect(markup).toContain('data-comparison-mode="elapsed-15"');
    expect(markup).toContain('可執行數量');
    expect(markup).toContain('實際使用時間');
    expect(markup).toContain('飛逝總淨收益');
    expect(markup).toContain('時間利用率');
    expect(markup).not.toContain('每批淨收益');
  });

  it('手動混合結果同時呈現在總覽列，沿用小數碎片產出', () => {
    const values = {
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
      comparisonMode: 'elapsed-15' as const,
    };
    const calculation = calculateEarningsOverviewTool(values);
    const mixedResult = calculateManualMixedCrushing(
      calculation.result!,
      { medical: 2, ammunition: 3, military: 4 },
    )!;
    const markup = renderToStaticMarkup(
      <EarningsOverviewResultTable
        labels={getMessages('zh-tw').tools.earningsOverview}
        locale="zh-tw"
        closeLabel={getMessages('zh-tw').context.closePanel}
        result={calculation.result!}
        mixedCrushingResult={mixedResult}
        formatNumber={createNumberFormatter('zh-tw')}
      />,
    );

    expect(markup).toContain('data-comparison-mode="elapsed-15"');
    expect(markup).toContain('醫療科技零件 2 個');
    expect(markup).toContain('彈藥科技零件 3 個');
    expect(markup).toContain('軍用彈藥科技零件 4 個');
    expect(markup).toContain('科技碎片產出: 10.8 個');
    expect(markup).toContain('data-earnings-overview-mixed-crushing="true"');
  });

  it('推薦／手動狀態開啟具名 dialog，X、Escape 與 backdrop 關閉並返回焦點', async () => {
    const manualCalculation = calculateEarningsOverviewTool({
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
      comparisonMode: 'per-minute',
    });
    const manualResult = calculateManualMixedCrushing(
      manualCalculation.result!,
      { medical: 2, ammunition: 3, military: 4 },
    );
    const { container, root } = createTrackedRoot();
    const labels = getMessages('zh-tw').tools.earningsOverview;
    const closeLabel = getMessages('zh-tw').context.closePanel;

    await act(async () => {
      root.render(
        <EarningsOverviewResultTable
          labels={labels}
          locale="zh-tw"
          closeLabel={closeLabel}
          result={manualCalculation.result!}
          mixedCrushingResult={manualResult}
          formatNumber={createNumberFormatter('zh-tw')}
        />,
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-mixed-crushing-details-trigger="true"]',
    )!;
    expect(trigger.textContent).toBe(mixedCrushingUiLabels['zh-tw'].manual);
    const mixedRow = container.querySelector<HTMLElement>(
      '[data-earnings-overview-mixed-crushing="true"]',
    )!;
    expect(mixedRow.textContent?.split(mixedCrushingUiLabels['zh-tw'].manual)).toHaveLength(2);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();

    trigger.focus();
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    let dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    const titleId = dialog?.getAttribute('aria-labelledby');
    expect(titleId).not.toBeNull();
    expect(document.getElementById(titleId!)?.textContent)
      .toBe(mixedCrushingUiLabels['zh-tw'].activity);
    expect(dialog?.querySelector('[data-mixed-crushing-details-dialog="true"]'))
      .not.toBeNull();

    const closeButton = dialog?.querySelector<HTMLButtonElement>(
      `[aria-label="${closeLabel}"]`,
    );
    expect(closeButton).not.toBeNull();
    await act(async () => {
      closeButton?.click();
      await Promise.resolve();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await Promise.resolve();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);

    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    const backdrop = document.body.querySelector<HTMLElement>('.bg-fd-overlay');
    expect(backdrop).not.toBeNull();
    await act(async () => {
      backdrop?.click();
      await Promise.resolve();
    });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).toBeNull();
  });

  it('明細四項使用 itemUnit、推薦/手動/飛逝變更即時同步且無效時清除 dialog', async () => {
    const manualCalculation = calculateEarningsOverviewTool({
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
      comparisonMode: 'per-minute',
    });
    const manualResult = calculateManualMixedCrushing(
      manualCalculation.result!,
      { medical: 2, ammunition: 3, military: 4 },
    );
    const { container, root } = createTrackedRoot();
    const labels = getMessages('zh-tw').tools.earningsOverview;
    const closeLabel = getMessages('zh-tw').context.closePanel;
    const formatNumber = createNumberFormatter('zh-tw');

    await act(async () => {
      root.render(
        <EarningsOverviewResultTable
          labels={labels}
          locale="zh-tw"
          closeLabel={closeLabel}
          result={manualCalculation.result!}
          mixedCrushingResult={manualResult}
          formatNumber={formatNumber}
        />,
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-mixed-crushing-details-trigger="true"]',
    )!;
    expect(trigger.textContent).toBe(mixedCrushingUiLabels['zh-tw'].manual);
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });
    let dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const detailList = dialog.querySelector<HTMLElement>(
      '[data-mixed-crushing-details-dialog="true"]',
    )!;
    const scrollContainer = container.querySelector<HTMLElement>(
      '[data-earnings-overview-table-scroll="true"]',
    )!;
    const overviewTable = scrollContainer.querySelector<HTMLTableElement>(
      'table[data-earnings-overview-table="true"]',
    )!;
    expect(detailList.closest('[data-result-layout="table"]')).toBeNull();
    expect(Array.from(overviewTable.querySelectorAll('tbody td'))
      .every((cell) => cell.classList.contains('whitespace-nowrap'))).toBe(true);
    expect(detailList.querySelectorAll('[data-mixed-crushing-detail-row]')).toHaveLength(3);
    expect(detailList.querySelector('[data-mixed-crushing-detail-row="medical"]')?.textContent)
      .toContain('2 個');
    expect(detailList.querySelector('[data-mixed-crushing-detail-row="ammunition"]')?.textContent)
      .toContain('3 個');
    expect(detailList.querySelector('[data-mixed-crushing-detail-row="military"]')?.textContent)
      .toContain('4 個');
    expect(detailList.querySelector('[data-mixed-crushing-detail-output]')?.textContent)
      .toContain('10.8 個');
    expect(overviewTable.querySelector('[data-earnings-overview-mixed-crushing]')?.textContent)
      .toContain('9 次');

    const elapsedCalculation = calculateEarningsOverviewTool({
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
      comparisonMode: 'elapsed-15',
    });
    const recommendedResult = calculateRecommendedMixedCrushing(elapsedCalculation.result!);
    await act(async () => {
      root.render(
        <EarningsOverviewResultTable
          labels={labels}
          locale="zh-tw"
          closeLabel={closeLabel}
          result={elapsedCalculation.result!}
          mixedCrushingResult={recommendedResult}
          formatNumber={formatNumber}
        />,
      );
    });
    expect(container.querySelector('[data-comparison-mode="elapsed-15"]')).not.toBeNull();
    expect(container.querySelector('[data-mixed-crushing-details-trigger="true"]')?.textContent)
      .toBe(mixedCrushingUiLabels['zh-tw'].recommended);
    const mixedRow = container.querySelector<HTMLElement>(
      '[data-earnings-overview-mixed-crushing="true"]',
    )!;
    expect(mixedRow.textContent?.split(mixedCrushingUiLabels['zh-tw'].recommended))
      .toHaveLength(2);
    dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const recommendedList = dialog.querySelector<HTMLElement>(
      '[data-mixed-crushing-details-dialog="true"]',
    )!;
    expect(recommendedList.querySelector('[data-mixed-crushing-detail-row="medical"]')?.textContent)
      .toContain(`${formatNumber(recommendedResult!.counts.medical, { maximumFractionDigits: 0 })} 個`);
    expect(recommendedList.querySelector('[data-mixed-crushing-detail-output]')?.textContent)
      .toContain(`${formatNumber(recommendedResult!.outputTechScrap, { maximumFractionDigits: 1 })} 個`);

    const revisedManualResult = calculateManualMixedCrushing(
      elapsedCalculation.result!,
      { medical: 1, ammunition: 0, military: 2 },
    );
    await act(async () => {
      root.render(
        <EarningsOverviewResultTable
          labels={labels}
          locale="zh-tw"
          closeLabel={closeLabel}
          result={elapsedCalculation.result!}
          mixedCrushingResult={revisedManualResult}
          formatNumber={formatNumber}
        />,
      );
    });
    expect(container.querySelector('[data-mixed-crushing-details-trigger="true"]')?.textContent)
      .toBe(mixedCrushingUiLabels['zh-tw'].manual);
    dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.querySelector('[data-mixed-crushing-detail-row="medical"]')?.textContent)
      .toContain('1 個');
    expect(dialog.querySelector('[data-mixed-crushing-detail-row="military"]')?.textContent)
      .toContain('2 個');

    await act(async () => {
      root.render(
        <EarningsOverviewResultTable
          labels={labels}
          locale="zh-tw"
          closeLabel={closeLabel}
          result={elapsedCalculation.result!}
          mixedCrushingResult={null}
          formatNumber={formatNumber}
        />,
      );
      await Promise.resolve();
    });
    expect(container.querySelector('[data-mixed-crushing-details-trigger]')).toBeNull();
    expect(document.body.querySelector('[data-mixed-crushing-details-dialog]')).toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
  });

  it('320px 中英文明細允許名稱換行、數量不拆行且彈窗採緊湊尺寸', async () => {
    const calculation = calculateEarningsOverviewTool({
      searchLevel: '500',
      printingLevel: '450',
      miningLevel: '420',
      bargainPercent: '40',
      btcBuffPercent: '80',
      comparisonMode: 'per-minute',
    });
    const mixedResult = calculateManualMixedCrushing(
      calculation.result!,
      { medical: 0, ammunition: 0, military: 1000 },
    );
    const { container, root } = createTrackedRoot();
    const closeLabel = getMessages('en').context.closePanel;

    await act(async () => {
      root.render(
        <EarningsOverviewResultTable
          labels={getMessages('en').tools.earningsOverview}
          locale="en"
          closeLabel={closeLabel}
          result={calculation.result!}
          mixedCrushingResult={mixedResult}
          formatNumber={createNumberFormatter('en')}
        />,
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-mixed-crushing-details-trigger="true"]',
    )!;
    await act(async () => {
      trigger.click();
      await Promise.resolve();
    });

    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const militaryRow = dialog.querySelector<HTMLElement>(
      '[data-mixed-crushing-detail-row="military"]',
    )!;
    expect(militaryRow.querySelector('dt')?.textContent)
      .toBe(mixedCrushingUiLabels.en.military);
    expect(militaryRow.querySelector('dt')?.classList.contains('whitespace-normal')).toBe(true);
    expect(militaryRow.querySelector('dd')?.textContent).toBe('1,000 items');
    expect(militaryRow.querySelector('dd')?.classList.contains('whitespace-nowrap')).toBe(true);
    expect(dialog.classList.contains('h-auto')).toBe(true);
    expect(dialog.classList.contains('max-w-sm')).toBe(true);
    expect(dialog.className).toContain('w-[calc(100vw-1rem)]');
    expect(dialog.className).toContain('sm:max-h-[min(80dvh,24rem)]');
    expect(container.querySelector('[data-earnings-overview-mixed-crushing]')?.textContent)
      .toContain('1,000 runs');

    const closeButton = dialog.querySelector<HTMLButtonElement>(
      `[aria-label="${closeLabel}"]`,
    )!;
    await act(async () => {
      closeButton.click();
      await Promise.resolve();
    });
    const chineseCloseLabel = getMessages('zh-tw').context.closePanel;
    await act(async () => {
      root.render(
        <EarningsOverviewResultTable
          labels={getMessages('zh-tw').tools.earningsOverview}
          locale="zh-tw"
          closeLabel={chineseCloseLabel}
          result={calculation.result!}
          mixedCrushingResult={mixedResult}
          formatNumber={createNumberFormatter('zh-tw')}
        />,
      );
    });
    const chineseTrigger = container.querySelector<HTMLButtonElement>(
      '[data-mixed-crushing-details-trigger="true"]',
    )!;
    await act(async () => {
      chineseTrigger.click();
      await Promise.resolve();
    });
    const chineseDialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const chineseMilitaryRow = chineseDialog.querySelector<HTMLElement>(
      '[data-mixed-crushing-detail-row="military"]',
    )!;
    expect(chineseMilitaryRow.querySelector('dt')?.textContent)
      .toBe(mixedCrushingUiLabels['zh-tw'].military);
    expect(chineseMilitaryRow.querySelector('dt')?.classList.contains('whitespace-normal'))
      .toBe(true);
    expect(chineseMilitaryRow.querySelector('dd')?.textContent).toBe('1,000 個');
    expect(chineseMilitaryRow.querySelector('dd')?.classList.contains('whitespace-nowrap'))
      .toBe(true);
  });

  it('無效手動數量提示錯誤、不保存，且總覽與固定圖表不比較該草稿', async () => {
    const storedState = {
      searchLevel: '1',
      printingLevel: '1',
      miningLevel: '1',
      bargainPercent: '0',
      btcBuffPercent: '100',
      comparisonMode: 'per-minute' as const,
      mixedCrushingMode: 'manual' as const,
      mixedMedicalCount: '0',
      mixedAmmunitionCount: '0',
      mixedMilitaryCount: '0',
    };
    saveToolState('earnings-overview', storedState, { storage: window.localStorage });

    const container = document.createElement('div');
    document.body.append(container);
    const store = createSharedUserInputsStore({ storage: null });
    const root = createRoot(container);
    mountedOverviews.push({ container, root, store });
    await act(async () => {
      root.render(
        <SharedUserInputsProvider store={store}>
          <EarningsOverviewToolProvider>
          <EarningsOverviewCalculator
            labels={getMessages('zh-tw').tools.earningsOverview}
            locale="zh-tw"
            closeLabel={getMessages('zh-tw').context.closePanel}
          />
          </EarningsOverviewToolProvider>
        </SharedUserInputsProvider>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const medicalInput = container.querySelector<HTMLInputElement>(
      '[data-mixed-crushing-number="medical"]',
    )!;
    const ammunitionInput = container.querySelector<HTMLInputElement>(
      '[data-mixed-crushing-number="ammunition"]',
    )!;
    const militaryInput = container.querySelector<HTMLInputElement>(
      '[data-mixed-crushing-number="military"]',
    )!;

    await act(async () => {
      setNumberInputValue(medicalInput, '1000');
      await Promise.resolve();
    });
    await act(async () => {
      setNumberInputValue(ammunitionInput, '1000');
      await Promise.resolve();
    });
    expect(militaryInput.max).toBe('775');
    await act(async () => {
      setNumberInputValue(militaryInput, '1000');
      await Promise.resolve();
    });

    const validation = container.querySelector<HTMLElement>(
      '[data-mixed-crushing-validation="time"]',
    );
    expect(validation?.getAttribute('role')).toBe('alert');
    expect(container.querySelector('[data-earnings-overview-mixed-crushing]')?.textContent)
      .toContain(getMessages('zh-tw').tools.earningsOverview.notAvailable);
    expect(loadToolState('earnings-overview', { storage: window.localStorage }))
      .toEqual({
        ...storedState,
        mixedMedicalCount: '1000',
        mixedAmmunitionCount: '1000',
      });

    const fixedTab = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((candidate) => candidate.textContent === getMessages('zh-tw')
        .tools.earningsOverview.trendGroupFixed)!;
    await act(async () => fixedTab.click());
    expect(container.querySelector<HTMLElement>(
      '[data-earnings-chart-fixed-value="crush-mixed"]',
    )?.textContent).toBe(getMessages('zh-tw').tools.earningsOverview.notAvailable);

    await act(async () => {
      setNumberInputValue(militaryInput, '2.5');
      await Promise.resolve();
    });
    expect(container.querySelector('[data-mixed-crushing-validation="count"]'))
      .not.toBeNull();
    expect(loadToolState('earnings-overview', { storage: window.localStorage }))
      .toEqual({
        ...storedState,
        mixedMedicalCount: '1000',
        mixedAmmunitionCount: '1000',
      });
  });

  it('有效手動組合切換到 30／15 分鐘時重設推薦並同步總覽、控制與固定圖表', async () => {
    const container = await mountInteractiveOverview();
    await activateFixedChart(container);

    await setMixedCount(container, 'medical', '12');
    await setMixedCount(container, 'ammunition', '3');
    await setMixedCount(container, 'military', '4');
    expect(container.querySelector('[data-mixed-crushing-controls]')
      ?.getAttribute('data-mixed-crushing-mode')).toBe('manual');
    expect(loadToolState('earnings-overview', { storage: window.localStorage }))
      .toMatchObject({
        mixedCrushingMode: 'manual',
        mixedMedicalCount: '12',
        mixedAmmunitionCount: '3',
        mixedMilitaryCount: '4',
      });

    await setComparisonMode(container, 'elapsed-30');
    expectRecommendedView(container, 'elapsed-30');
    expect(loadToolState('earnings-overview', { storage: window.localStorage }))
      .toMatchObject({
        comparisonMode: 'elapsed-30',
        mixedCrushingMode: 'recommended',
        mixedMedicalCount: '0',
        mixedAmmunitionCount: '0',
        mixedMilitaryCount: '0',
      });

    await setComparisonMode(container, 'elapsed-15');
    expectRecommendedView(container, 'elapsed-15');
    expect(loadToolState('earnings-overview', { storage: window.localStorage }))
      .toMatchObject({
        comparisonMode: 'elapsed-15',
        mixedCrushingMode: 'recommended',
        mixedMedicalCount: '0',
        mixedAmmunitionCount: '0',
        mixedMilitaryCount: '0',
      });
  });

  it('切換到 105 分鐘或每分鐘會清除無效草稿與錯誤並顯示該模式推薦', async () => {
    const container = await mountInteractiveOverview();
    await activateFixedChart(container);

    await setMixedCount(container, 'medical', '2.5');
    expect(container.querySelector('[data-mixed-crushing-validation="count"]'))
      .not.toBeNull();
    await setComparisonMode(container, 'elapsed-105');
    expectRecommendedView(container, 'elapsed-105');

    await setMixedCount(container, 'medical', '2.5');
    expect(container.querySelector('[data-mixed-crushing-validation="count"]'))
      .not.toBeNull();
    await setComparisonMode(container, 'per-minute');
    expectRecommendedView(container, 'per-minute');
    expect(loadToolState('earnings-overview', { storage: window.localStorage }))
      .toMatchObject({
        comparisonMode: 'per-minute',
        mixedCrushingMode: 'recommended',
        mixedMedicalCount: '0',
        mixedAmmunitionCount: '0',
        mixedMilitaryCount: '0',
      });
  });

  it('重選相同比較方式不清除手動草稿或覆寫已保存的組合', async () => {
    const container = await mountInteractiveOverview();
    await setMixedCount(container, 'medical', '27');

    await act(async () => {
      setSelectValue(
        container.querySelector<HTMLSelectElement>('#earnings-overview-comparison-mode')!,
        'per-minute',
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-mixed-crushing-controls]')
      ?.getAttribute('data-mixed-crushing-mode')).toBe('manual');
    expect(container.querySelector<HTMLInputElement>(
      '[data-mixed-crushing-number="medical"]',
    )?.value).toBe('27');
    expect(container.querySelector<HTMLElement>(
      '[data-earnings-overview-mixed-crushing]',
    )?.textContent).toContain(mixedCrushingUiLabels['zh-tw'].manual);
    expect(loadToolState('earnings-overview', { storage: window.localStorage }))
      .toMatchObject({
        comparisonMode: 'per-minute',
        mixedCrushingMode: 'manual',
        mixedMedicalCount: '27',
      });
  });

  it('三語系都提供比較方式與飛逝選項文案', () => {
    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      const labels = getMessages(locale).tools.earningsOverview;
      const markup = renderEarningsOverview(
        <EarningsOverviewCalculator
          labels={labels}
          locale={locale}
          closeLabel={getMessages(locale).context.closePanel}
        />,
      );

      expect(markup).toContain(labels.comparisonMode);
      expect(markup).toContain(labels.elapsed105Option);
      expect(markup).toContain(labels.trendTitle);
      expect(markup).toContain(labels.trendGroup);
      expect(markup).toContain(labels.trendInteractionHint);
      expect(markup).toContain(mixedCrushingUiLabels[locale].recommended);
      expect(markup).toContain(mixedCrushingUiLabels[locale].itemUnit);
      expect(markup).not.toContain('Details');
      expect(markup).toContain(mixedCrushingUiLabels[locale].manualControls);
      expect(markup).not.toContain('checkbox');
      expect(markup).not.toContain('勾選');
      expect(markup).not.toContain('勾选');
      expect(labels.timeUtilization).not.toBe('');
    }
  });
});
