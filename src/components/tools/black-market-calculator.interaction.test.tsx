// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { SharedUserInputsProvider } from '@/components/shared-user-inputs';
import { createSharedUserInputsStore } from '@/lib/storage';
import { getMessages } from '@/lib/translations';

import { BlackMarketCalculator, BlackMarketToolProvider } from './black-market-calculator';

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
});
