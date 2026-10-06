// @vitest-environment happy-dom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import type { LootBoxId } from '@/data/game/loot-boxes';
import type { Locale } from '@/lib/i18n';
import {
  createDefaultLootBoxAnalysisState,
  createLootBoxAnalysisRecord,
  simulateLootBoxValuesAsync,
  upsertLootBoxAnalysisRecord,
  type LootBoxAnalysisState,
} from '@/lib/loot-box-analysis';
import {
  createSharedUserInputsStore,
  loadToolState,
  saveToolState,
} from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  LootBoxAnalysisCalculator,
  LootBoxAnalysisToolProvider,
  createDefaultLootBoxAnalysisDraft,
  parseLootBoxAnalysisDraft,
} from './loot-box-analysis';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedLootBox {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
  readonly simulationCalls: readonly SimulationCall[];
}

type SimulationRunner = typeof simulateLootBoxValuesAsync;

interface SimulationCall {
  readonly boxType: LootBoxId;
  readonly openings: number;
}

interface MountLootBoxOptions {
  readonly locale?: Locale;
  readonly simulationRunner?: SimulationRunner;
}

async function mountLootBox(options: MountLootBoxOptions = {}): Promise<MountedLootBox> {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  const root = createRoot(container);
  const simulationCalls: SimulationCall[] = [];
  const simulationRunner = options.simulationRunner ?? (async (boxType, openings) => {
    simulationCalls.push({ boxType, openings });
    return [1, 2, 3];
  });
  const locale = options.locale ?? 'zh-tw';
  const labels = getMessages(locale).tools.lootBoxAnalysis;

  await act(async () => {
    root.render(
      <StrictMode>
        <SharedUserInputsProvider store={store}>
          <LootBoxAnalysisToolProvider simulationRunner={simulationRunner}>
            <LootBoxAnalysisCalculator labels={labels} locale={locale} />
          </LootBoxAnalysisToolProvider>
        </SharedUserInputsProvider>
      </StrictMode>,
    );
    await Promise.resolve();
  });

  return { container, root, store, simulationCalls };
}

async function unmountLootBox(mounted: MountedLootBox): Promise<void> {
  await act(async () => {
    mounted.root.unmount();
    await Promise.resolve();
  });
  mounted.store.dispose();
  mounted.container.remove();
}

function findSaveButton(container: HTMLElement): HTMLButtonElement {
  const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
  const button = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(labels.saveRecord),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('找不到開箱紀錄儲存按鈕');
  }
  return button;
}

function findSubmitButton(container: HTMLElement): HTMLButtonElement {
  const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
  const button = Array.from(container.querySelectorAll('button')).find((item) =>
    item.textContent?.includes(labels.saveRecord) || item.textContent?.includes(labels.updateRecord),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error('找不到開箱紀錄送出按鈕');
  }
  return button;
}

async function flushSimulation(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 input value setter');
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!setter) throw new Error('找不到 select value setter');
  setter.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function createStoredLootBoxState(recordedAt = 1_700_000_000_000): LootBoxAnalysisState {
  const record = createLootBoxAnalysisRecord({
    id: 'existing-loot-box-record',
    recordedAt,
    boxType: 'white',
    openings: 1,
    drops: [{ dropId: 'item-hash', quantity: 1 }],
  });
  return upsertLootBoxAnalysisRecord(createDefaultLootBoxAnalysisState(), record);
}

function createStoredLootBoxStateWithRecords(count: number): LootBoxAnalysisState {
  return Array.from({ length: count }, (_, index) => createLootBoxAnalysisRecord({
    id: `stored-loot-box-record-${index}`,
    recordedAt: 1_700_000_000_000 + index,
    boxType: 'white',
    openings: 1,
    drops: [{ dropId: 'item-hash', quantity: index + 1 }],
  })).reduce(
    (state, record) => upsertLootBoxAnalysisRecord(state, record),
    createDefaultLootBoxAnalysisState(),
  );
}

function createStoredLootBoxStateWithBoxes(): LootBoxAnalysisState {
  return [
    createLootBoxAnalysisRecord({
      id: 'white-loot-box-record',
      recordedAt: 1_700_000_000_000,
      boxType: 'white',
      openings: 1,
      drops: [{ dropId: 'item-hash', quantity: 1 }],
    }),
    createLootBoxAnalysisRecord({
      id: 'yellow-loot-box-record',
      recordedAt: 1_700_000_000_001,
      boxType: 'yellow',
      openings: 1,
      drops: [{ dropId: 'item-hash', quantity: 1 }],
    }),
  ].reduce(
    (state, record) => upsertLootBoxAnalysisRecord(state, record),
    createDefaultLootBoxAnalysisState(),
  );
}

describe('Loot box analysis calculator', () => {
  it('初始未選擇箱型，不顯示錯誤或掉落欄位', () => {
    const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
    const markup = renderToStaticMarkup(
      <SharedUserInputsProvider>
        <LootBoxAnalysisToolProvider>
          <LootBoxAnalysisCalculator labels={labels} locale="zh-tw" />
        </LootBoxAnalysisToolProvider>
      </SharedUserInputsProvider>,
    );

    expect(markup).toContain('data-tool="loot-box-analysis"');
    expect(markup).toContain('id="loot-box-analysis-openings"');
    expect(markup).toContain('value=""');
    expect(markup).toContain(`<option value="" disabled="" selected="">${labels.boxPlaceholder}</option>`);
    expect(markup).not.toContain('id="loot-box-analysis-item-hash"');
    expect(markup).toContain('開箱數');
    expect(markup).toContain('開箱紀錄');
    expect(markup).not.toContain(labels.validationSummary);
    expect(markup).not.toContain(labels.validationBox);
    expect(markup).not.toContain(labels.validationOpenings.replace('${max}', '1'));
    expect(markup).not.toContain(labels.validationDrop);
    expect(markup.match(new RegExp(labels.expectedGrossPerBox, 'g'))).toHaveLength(3);
    expect(markup.match(new RegExp(labels.expectedNetPerBox, 'g'))).toHaveLength(3);
    for (const boxLabel of ['白箱', '黃箱', '紫箱']) {
      expect(markup).toContain(boxLabel);
    }
  });

  it('要求開箱數為正整數，並至少輸入一項掉落物', () => {
    const draft = createDefaultLootBoxAnalysisDraft();
    expect(parseLootBoxAnalysisDraft(draft).input).toBeNull();
    expect(draft).toEqual({ boxType: '', openings: '', quantities: {} });

    const whiteDraft = createDefaultLootBoxAnalysisDraft('white');
    const parsed = parseLootBoxAnalysisDraft({
      ...whiteDraft,
      openings: '2',
      quantities: { ...whiteDraft.quantities, 'item-hash': '32' },
    });
    expect(parsed.errors).toEqual({});
    expect(parsed.input).toMatchObject({
      boxType: 'white',
      openings: 2,
      drops: [{ dropId: 'item-hash', quantity: 32 }],
    });

    expect(parseLootBoxAnalysisDraft({
      ...whiteDraft,
      openings: '1.5',
      quantities: { ...whiteDraft.quantities, 'item-hash': '1' },
    }).input).toBeNull();

    expect(parseLootBoxAnalysisDraft({
      ...whiteDraft,
      openings: '13',
      quantities: { ...whiteDraft.quantities, 'item-hash': '1' },
    }).errors).toEqual({ openings: 'openings' });

    const yellowDraft = createDefaultLootBoxAnalysisDraft('yellow');
    expect(yellowDraft.openings).toBe('8');
    expect(parseLootBoxAnalysisDraft({
      ...yellowDraft,
      openings: '9',
      quantities: { ...yellowDraft.quantities, 'item-hash': '1' },
    }).errors).toEqual({ openings: 'openings' });
  });

  it('選擇黃箱後自動填入 8 箱，無效提交才顯示錯誤', async () => {
    window.localStorage.clear();
    const mounted = await mountLootBox();
    const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
    try {
      const select = mounted.container.querySelector<HTMLSelectElement>(
        '#loot-box-analysis-box-type',
      );
      const openings = mounted.container.querySelector<HTMLInputElement>(
        '#loot-box-analysis-openings',
      );
      if (!select || !openings) throw new Error('找不到箱子類型或開箱數欄位');

      expect(openings.value).toBe('');
      expect(mounted.container.querySelector('#loot-box-analysis-item-hash')).toBeNull();

      await act(async () => {
        setSelectValue(select, 'yellow');
        await Promise.resolve();
      });
      expect(openings.value).toBe('8');
      expect(mounted.container.querySelector('#loot-box-analysis-item-hash')).not.toBeNull();
      expect(mounted.container.textContent).not.toContain(labels.validationSummary);

      await act(async () => {
        findSubmitButton(mounted.container).click();
        await Promise.resolve();
      });
      expect(mounted.container.textContent).toContain(labels.validationSummary);
      expect(mounted.container.textContent).toContain(labels.validationDrop);
      expect(loadToolState<LootBoxAnalysisState>('loot-box-analysis')?.records).toHaveLength(0);
    } finally {
      await unmountLootBox(mounted);
    }
  });

  it('Strict Mode 下既有開箱紀錄首次與重新掛載後都不會被初始空狀態清空', async () => {
    window.localStorage.clear();
    const storedState = createStoredLootBoxState();
    saveToolState('loot-box-analysis', storedState);

    const firstMount = await mountLootBox();
    try {
      expect(loadToolState('loot-box-analysis')).toEqual(storedState);
      expect(firstMount.container.querySelector('tbody tr')).not.toBeNull();
    } finally {
      await unmountLootBox(firstMount);
    }

    const secondMount = await mountLootBox();
    try {
      expect(loadToolState('loot-box-analysis')).toEqual(storedState);
      expect(secondMount.container.querySelector('tbody tr')).not.toBeNull();
    } finally {
      await unmountLootBox(secondMount);
    }
  });

  it('新增與更新紀錄會各自觸發一次該箱型模擬，Strict Mode 不會重複觸發', async () => {
    window.localStorage.clear();
    const mounted = await mountLootBox();
    try {
      const select = mounted.container.querySelector<HTMLSelectElement>(
        '#loot-box-analysis-box-type',
      );
      if (!select) throw new Error('找不到箱子類型選擇欄位');

      await act(async () => {
        setSelectValue(select, 'yellow');
        await Promise.resolve();
      });
      const input = mounted.container.querySelector<HTMLInputElement>(
        '#loot-box-analysis-item-hash',
      );
      if (!input) throw new Error('找不到雜湊處理器輸入欄位');
      setInputValue(input, '1');
      await act(async () => {
        await Promise.resolve();
      });
      expect(findSaveButton(mounted.container).disabled).toBe(false);
      await act(async () => {
        findSaveButton(mounted.container).click();
        await flushSimulation();
      });

      const saved = loadToolState<LootBoxAnalysisState>('loot-box-analysis');
      expect(saved?.records).toHaveLength(1);
      expect(saved?.records[0]).toMatchObject({
        boxType: 'yellow',
        openings: 8,
        drops: [{ dropId: 'item-hash', quantity: 1 }],
      });
      expect(mounted.simulationCalls).toEqual([{ boxType: 'yellow', openings: 8 }]);
      expect(select.value).toBe('');
      expect(mounted.container.querySelector<HTMLInputElement>('#loot-box-analysis-openings')?.value).toBe('');
      expect(mounted.container.querySelector('#loot-box-analysis-item-hash')).toBeNull();

      const editButton = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="編輯: 黃箱"]',
      );
      if (!editButton) throw new Error('找不到白箱紀錄編輯按鈕');
      await act(async () => {
        editButton.click();
        await Promise.resolve();
      });
      const editedInput = mounted.container.querySelector<HTMLInputElement>(
        '#loot-box-analysis-item-hash',
      );
      if (!editedInput) throw new Error('編輯時找不到雜湊處理器輸入欄位');
      setInputValue(editedInput, '2');
      await act(async () => {
        await Promise.resolve();
        findSubmitButton(mounted.container).click();
        await flushSimulation();
      });

      expect(mounted.simulationCalls).toEqual([
        { boxType: 'yellow', openings: 8 },
        { boxType: 'yellow', openings: 8 },
      ]);
    } finally {
      await unmountLootBox(mounted);
    }
  });

  it('部分箱型有紀錄時仍顯示固定順序的三張卡，未記錄箱卡只顯示期望收益', async () => {
    window.localStorage.clear();
    saveToolState('loot-box-analysis', createStoredLootBoxState());
    const mounted = await mountLootBox();
    const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
    try {
      const results = mounted.container.querySelector<HTMLElement>(
        'section[aria-labelledby="loot-box-analysis-results-title"]',
      );
      if (!results) throw new Error('找不到價值分析結果區');
      expect(Array.from(results.querySelectorAll<HTMLElement>('[data-loot-box-id]')).map((card) =>
        card.dataset.lootBoxId,
      )).toEqual(['white', 'yellow', 'purple']);
      expect(results.textContent).not.toContain('模擬分析');
      expect(results.textContent).not.toContain('以相同箱子類型與開箱數進行隨機模擬');

      const recordedCard = results.querySelector<HTMLElement>('[data-loot-box-id="white"]');
      const unrecordedCard = results.querySelector<HTMLElement>('[data-loot-box-id="yellow"]');
      if (!recordedCard || !unrecordedCard) throw new Error('找不到白箱或黃箱結果卡片');

      const button = recordedCard.querySelector<HTMLButtonElement>('button');
      expect(button?.textContent).toContain(labels.runSimulation);
      expect(button?.textContent).not.toContain('執行模擬');
      expect(getMessages('en').tools.lootBoxAnalysis.runSimulation).toBe('Rerun simulation');
      expect(unrecordedCard.querySelector('button')).toBeNull();
      expect(unrecordedCard.textContent).toContain(labels.expectedGrossPerBox);
      expect(unrecordedCard.textContent).toContain(labels.expectedNetPerBox);
      expect(unrecordedCard.textContent).not.toContain(labels.recordCount);
      expect(unrecordedCard.textContent).not.toContain(labels.actualOpenings);
      expect(unrecordedCard.textContent).not.toContain(labels.dropAnalysis);
      expect(unrecordedCard.textContent).not.toContain(labels.actualPercentile);

      await act(async () => {
        button?.click();
        await flushSimulation();
      });

      const overview = recordedCard.querySelector<HTMLElement>(
        '[aria-labelledby="loot-box-analysis-overview-white"]',
      );
      const percentile = Array.from(overview?.querySelectorAll('dt') ?? [])
        .find((item) => item.textContent === labels.actualPercentile);
      expect(percentile?.parentElement?.querySelector('dd')?.textContent).not.toBe('—');
      expect(recordedCard.textContent).not.toContain('模擬分析');
      expect(recordedCard.textContent).not.toContain('以相同箱子類型與開箱數進行隨機模擬');
      expect(recordedCard.querySelector('[role="status"]')).toBeNull();
    } finally {
      await unmountLootBox(mounted);
    }
  });

  it('模擬進行中只在右上角按鈕顯示執行中文字，卡片底部不再顯示模擬區塊', async () => {
    window.localStorage.clear();
    saveToolState('loot-box-analysis', createStoredLootBoxState());
    let resolveSimulation!: (values: readonly number[]) => void;
    const simulationPromise = new Promise<readonly number[]>((resolve) => {
      resolveSimulation = resolve;
    });
    const mounted = await mountLootBox({
      simulationRunner: async () => simulationPromise,
    });
    const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
    try {
      const card = mounted.container.querySelector<HTMLElement>('[data-loot-box-id="white"]');
      if (!card) throw new Error('找不到白箱結果卡片');
      const button = card.querySelector<HTMLButtonElement>('button');
      if (!button) throw new Error('找不到白箱模擬按鈕');

      await act(async () => {
        button.click();
        await Promise.resolve();
      });

      expect(button.textContent).toContain(labels.simulationRunning);
      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');
      expect((card.textContent?.match(new RegExp(labels.simulationRunning, 'g')) ?? [])).toHaveLength(1);
      expect(card.textContent).not.toContain('模擬分析');
      expect(card.textContent).not.toContain('以相同箱子類型與開箱數進行隨機模擬');
      expect(card.querySelector('[role="status"]')).toBeNull();

      await act(async () => {
        resolveSimulation([1, 2, 3]);
        await flushSimulation();
      });
    } finally {
      await unmountLootBox(mounted);
    }
  });

  it('中英文紀錄時間都使用本機 Date 的 YYYY/MM/DD HH:mm 格式', async () => {
    window.localStorage.clear();
    const recordedAt = new Date(2026, 8, 8, 3, 4, 42, 0).getTime();
    saveToolState('loot-box-analysis', createStoredLootBoxState(recordedAt));

    for (const locale of ['zh-tw', 'zh-cn', 'en'] as const) {
      const mounted = await mountLootBox({ locale });
      try {
        const dateCell = mounted.container.querySelector<HTMLElement>(
          'section[aria-labelledby="loot-box-analysis-records-title"] tbody tr td',
        );
        expect(dateCell?.textContent).toBe('2026/09/08 03:04');
      } finally {
        await unmountLootBox(mounted);
      }
    }
  });

  it('不同箱型的模擬結果可同時保留，重跑其中一箱不會清除另一箱', async () => {
    window.localStorage.clear();
    saveToolState('loot-box-analysis', createStoredLootBoxStateWithBoxes());
    const mounted = await mountLootBox();
    try {
      const getSimulationButton = (boxType: LootBoxId) =>
        mounted.container.querySelector<HTMLButtonElement>(
          `[data-loot-box-id="${boxType}"] > div > button`,
        );
      const getPercentileValue = (boxType: LootBoxId) => {
        const card = mounted.container.querySelector<HTMLElement>(`[data-loot-box-id="${boxType}"]`);
        const overview = card?.querySelector<HTMLElement>(
          `[aria-labelledby="loot-box-analysis-overview-${boxType}"]`,
        );
        const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
        const item = Array.from(overview?.querySelectorAll('dt') ?? [])
          .find((entry) => entry.textContent === labels.actualPercentile);
        return item?.parentElement?.querySelector('dd')?.textContent;
      };

      await act(async () => {
        getSimulationButton('white')?.click();
        await flushSimulation();
      });
      await act(async () => {
        getSimulationButton('yellow')?.click();
        await flushSimulation();
      });

      expect(getPercentileValue('white')).not.toBe('—');
      expect(getPercentileValue('yellow')).not.toBe('—');
      expect(mounted.simulationCalls).toEqual([
        { boxType: 'white', openings: 1 },
        { boxType: 'yellow', openings: 1 },
      ]);
    } finally {
      await unmountLootBox(mounted);
    }
  });

  it('紀錄表每頁 20 筆，可換頁，且刪除最後一頁後會安全回到有效頁碼', async () => {
    window.localStorage.clear();
    saveToolState('loot-box-analysis', createStoredLootBoxStateWithRecords(21));
    const mounted = await mountLootBox();
    const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
    const originalConfirm = window.confirm;
    try {
      const getRows = () => mounted.container.querySelectorAll(
        'section[aria-labelledby="loot-box-analysis-records-title"] tbody tr',
      );
      const getButton = (label: string) => mounted.container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
      );
      const getPageStatus = () => mounted.container.querySelector('[role="status"]');

      expect(getRows()).toHaveLength(20);
      expect(getPageStatus()?.textContent).toContain('第 1 / 2 頁');
      expect(getButton(labels.previousPage)?.disabled).toBe(true);
      expect(getButton(labels.nextPage)?.disabled).toBe(false);

      await act(async () => {
        getButton(labels.nextPage)?.click();
        await Promise.resolve();
      });
      expect(getRows()).toHaveLength(1);
      expect(getPageStatus()?.textContent).toContain('第 2 / 2 頁');
      expect(getButton(labels.previousPage)?.disabled).toBe(false);
      expect(getButton(labels.nextPage)?.disabled).toBe(true);

      window.confirm = () => true;
      const deleteButton = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.getAttribute('aria-label')?.startsWith(`${labels.delete}:`),
      );
      if (!deleteButton) throw new Error('找不到最後一頁的刪除按鈕');
      await act(async () => {
        deleteButton.click();
        await Promise.resolve();
      });
      expect(getRows()).toHaveLength(20);
      expect(getPageStatus()?.textContent).toContain('第 1 / 1 頁');
      expect(getButton(labels.previousPage)?.disabled).toBe(true);
      expect(getButton(labels.nextPage)?.disabled).toBe(true);
    } finally {
      window.confirm = originalConfirm;
      await unmountLootBox(mounted);
    }
  });

  it('重設清空表單並將紀錄表回到第一頁，但保留所有開箱紀錄', async () => {
    window.localStorage.clear();
    const storedState = createStoredLootBoxStateWithRecords(21);
    saveToolState('loot-box-analysis', storedState);
    const mounted = await mountLootBox();
    const labels = getMessages('zh-tw').tools.lootBoxAnalysis;
    try {
      const getRows = () => mounted.container.querySelectorAll(
        'section[aria-labelledby="loot-box-analysis-records-title"] tbody tr',
      );
      const getButton = (label: string) => mounted.container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"]`,
      );
      const boxType = mounted.container.querySelector<HTMLSelectElement>(
        '#loot-box-analysis-box-type',
      )!;

      await act(async () => {
        getButton(labels.nextPage)?.click();
        await Promise.resolve();
      });
      expect(mounted.container.querySelector('[role="status"]')?.textContent)
        .toContain('第 2 / 2 頁');

      await act(async () => {
        setSelectValue(boxType, 'white');
        await Promise.resolve();
      });
      await act(async () => {
        setInputValue(mounted.container.querySelector<HTMLInputElement>(
          '#loot-box-analysis-openings',
        )!, '1');
        setInputValue(mounted.container.querySelector<HTMLInputElement>(
          '#loot-box-analysis-item-hash',
        )!, '2');
        await Promise.resolve();
      });
      expect(boxType.value).toBe('white');
      expect(mounted.container.querySelector<HTMLInputElement>(
        '#loot-box-analysis-item-hash',
      )?.value).toBe('2');

      await act(async () => {
        mounted.container.querySelector<HTMLButtonElement>('[data-tool-reset=""]')?.click();
        await Promise.resolve();
      });

      expect(boxType.value).toBe('');
      expect(mounted.container.querySelector<HTMLInputElement>(
        '#loot-box-analysis-openings',
      )?.value).toBe('');
      expect(mounted.container.querySelector('#loot-box-analysis-item-hash')).toBeNull();
      expect(getRows()).toHaveLength(20);
      expect(mounted.container.querySelector('[role="status"]')?.textContent)
        .toContain('第 1 / 2 頁');
      expect(loadToolState<LootBoxAnalysisState>('loot-box-analysis')).toEqual(storedState);
    } finally {
      await unmountLootBox(mounted);
    }
  });
});
