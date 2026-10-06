// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import {
  BlackMarketCalculator,
  BlackMarketToolProvider,
  calculateBlackMarketTool,
  selectBlackMarketSharedValues,
} from './black-market-calculator';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface MountedBlackMarket {
  readonly container: HTMLDivElement;
  readonly root: Root;
  readonly store: ReturnType<typeof createSharedUserInputsStore>;
}

const mounted: MountedBlackMarket[] = [];

async function mount(): Promise<MountedBlackMarket> {
  const container = document.createElement('div');
  document.body.append(container);
  const store = createSharedUserInputsStore({ storage: null });
  const root = createRoot(container);
  const result = { container, root, store };
  mounted.push(result);

  await act(async () => {
    root.render(
      <SharedUserInputsProvider store={store}>
        <BlackMarketToolProvider>
          <BlackMarketCalculator
            labels={getMessages('zh-tw').tools.blackMarket}
            locale="zh-tw"
          />
        </BlackMarketToolProvider>
      </SharedUserInputsProvider>,
    );
    await Promise.resolve();
  });

  return result;
}

async function setValue(container: HTMLElement, id: string, value: string): Promise<void> {
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`找不到輸入欄位：${id}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) throw new Error('找不到 input value setter');
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

function readBreakEvenValues(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll<HTMLTableCellElement>('tbody tr td:last-child'),
    (cell) => cell.textContent?.trim() ?? '',
  );
}

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await act(async () => item.root.unmount());
    item.store.dispose();
    item.container.remove();
  }
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe('Black market calculator shared input interactions', () => {
  it('主要區直接更新共同資料，非法值不寫入，重設只還原本工具欄位', async () => {
    const { container, store } = await mount();
    const initialResult = container.querySelector('tbody')?.textContent;

    await setValue(container, 'black-market-printing-level', '333');
    await setValue(container, 'black-market-bargain-percent', '25');
    await setValue(container, 'black-market-btc-per-ai', '9000');
    await setValue(container, 'black-market-trash-cache-rate', '11');
    await setValue(container, 'black-market-rare-amount', '44');
    await setValue(container, 'black-market-btc-buff-percent', '2');

    expect(store.getSnapshot().equipment.bargainPercent).toBe(25);
    expect(store.getSnapshot().economy.exchangeRates).toContainEqual({
      id: 'btc-per-ai',
      value: 9000,
    });
    expect(store.getSnapshot().economy.cacheRates).toContainEqual({ id: 'trash', value: 11 });
    expect(container.querySelector('tbody')?.textContent).not.toBe(initialResult);

    const sharedBeforeInvalid = store.getSnapshot();
    await setValue(container, 'black-market-trash-cache-rate', '0');
    expect(store.getSnapshot()).toEqual(sharedBeforeInvalid);
    expect(container.querySelector<HTMLInputElement>('#black-market-trash-cache-rate')
      ?.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toBe(getMessages('zh-tw').settingsPage.sharedValueError);

    await setValue(container, 'black-market-trash-cache-rate', '11');
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-tool-reset=""]')?.click();
    });

    expect(container.querySelector<HTMLInputElement>('#black-market-printing-level')?.value)
      .toBe('1');
    expect(container.querySelector<HTMLInputElement>('#black-market-rare-amount')?.value)
      .toBe('1000');
    expect(container.querySelector<HTMLInputElement>('#black-market-btc-buff-percent')
      ?.getAttribute('aria-valuenow')).toBe('100');
    expect(store.getSnapshot()).toEqual(sharedBeforeInvalid);
  });

  it('依四品質實際門檻顯示未達、等於、已超過與無法回本狀態', async () => {
    const { container, store } = await mount();
    const labels = getMessages('zh-tw').tools.blackMarket;

    await act(async () => {
      store.update((current) => ({
        ...current,
        equipment: { ...current.equipment, bargainPercent: 40 },
        economy: {
          ...current.economy,
          exchangeRates: [{ id: 'btc-per-ai', value: 8450 }],
          cacheRates: [
            { id: 'trash', value: 9 },
            { id: 'common', value: 8 },
            { id: 'high-quality', value: 6 },
            { id: 'rare', value: 3 },
          ],
        },
      }));
      await Promise.resolve();
    });

    const calculationAtLevel = (printingLevel: number) => calculateBlackMarketTool({
      ...selectBlackMarketSharedValues(store.getSnapshot()),
      printingLevel: String(printingLevel),
      btcBuffPercent: '100',
      trashAmount: '1000',
      commonAmount: '1000',
      highQualityAmount: '1000',
      rareAmount: '1000',
    });

    await setValue(container, 'black-market-printing-level', '371');
    expect(calculationAtLevel(371).result?.map((result) => result.breakEvenLevel)).toEqual([
      380,
      372,
      403,
      739,
    ]);
    expect(readBreakEvenValues(container)).toEqual([
      'Lv.380 (+ 9)',
      'Lv.372 (+ 1)',
      'Lv.403 (+ 32)',
      'Lv.739 (+ 368)',
    ]);

    for (const [qualityIndex, level] of [[0, 380], [1, 372], [2, 403], [3, 739]] as const) {
      await setValue(container, 'black-market-printing-level', String(level));
      expect(calculationAtLevel(level).result?.[qualityIndex]?.breakEvenLevel).toBe(level);
      expect(readBreakEvenValues(container)[qualityIndex]).toBe(`已達回本（Lv.${level}）`);
    }

    await setValue(container, 'black-market-printing-level', '372');
    expect(readBreakEvenValues(container)).toEqual([
      'Lv.380 (+ 8)',
      '已達回本（Lv.372）',
      'Lv.403 (+ 31)',
      'Lv.739 (+ 367)',
    ]);
    const reachedCell = container.querySelectorAll<HTMLTableCellElement>(
      'tbody tr td:last-child',
    )[1];
    expect(reachedCell.classList.contains('whitespace-nowrap')).toBe(false);
    expect(reachedCell.querySelector('span.whitespace-nowrap')?.textContent).toBe('（Lv.372）');

    await setValue(container, 'black-market-printing-level', '500');
    expect(readBreakEvenValues(container)).toEqual([
      '已達回本（Lv.380）',
      '已達回本（Lv.372）',
      '已達回本（Lv.403）',
      'Lv.739 (+ 239)',
    ]);

    await setValue(container, 'black-market-printing-level', '740');
    expect(readBreakEvenValues(container)).toEqual([
      '已達回本（Lv.380）',
      '已達回本（Lv.372）',
      '已達回本（Lv.403）',
      '已達回本（Lv.739）',
    ]);

    await act(async () => {
      store.update((current) => ({
        ...current,
        economy: {
          ...current.economy,
          exchangeRates: [{ id: 'btc-per-ai', value: 1_000_000_000 }],
        },
      }));
      await Promise.resolve();
    });
    expect(selectBlackMarketSharedValues(store.getSnapshot()).btcPerAi).toBe('1000000000');
    expect(calculationAtLevel(500).result?.every((result) => result.breakEvenLevel === null))
      .toBe(true);
    expect(readBreakEvenValues(container)).toEqual(Array(4).fill(labels.notAvailable));
  });
});
