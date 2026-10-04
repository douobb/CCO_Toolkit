// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { getToolStorageKey, saveToolState } from './index';
import { useToolStateStorage } from './use-tool-state';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

interface TestState {
  readonly value: number;
}

const isTestState = (value: unknown): value is TestState =>
  typeof value === 'object'
  && value !== null
  && Number.isSafeInteger((value as TestState).value);

const normalizeTestState = (value: unknown): TestState | undefined => {
  if (!isTestState(value)) return undefined;
  return { value: value.value + 10 };
};

function StateView() {
  const [state] = useToolStateStorage<TestState>(
    'import-sync-test',
    { value: 0 },
    { validate: isTestState },
  );
  return <output>{state.value}</output>;
}

function NormalizedStateView() {
  const [state] = useToolStateStorage<TestState>(
    'normalize-sync-test',
    { value: 0 },
    {
      validate: isTestState,
      normalize: normalizeTestState,
    },
  );
  return <output>{state.value}</output>;
}

afterEach(() => {
  window.localStorage.clear();
  document.body.replaceChildren();
});

describe('useToolStateStorage 外部更新', () => {
  it('收到相同工具 key 的 storage event 後立即載入新狀態', async () => {
    saveToolState('import-sync-test', { value: 1 });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<StateView />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toBe('1');

    await act(async () => {
      saveToolState('import-sync-test', { value: 2 });
      window.dispatchEvent(new StorageEvent('storage', {
        key: getToolStorageKey('import-sync-test'),
      }));
      await Promise.resolve();
    });
    expect(container.textContent).toBe('2');

    await act(async () => root.unmount());
  });

  it('初次載入與 storage event 都使用 normalize', async () => {
    saveToolState('normalize-sync-test', { value: 1 });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<NormalizedStateView />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container.textContent).toBe('11');

    await act(async () => {
      saveToolState('normalize-sync-test', { value: 2 });
      window.dispatchEvent(new StorageEvent('storage', {
        key: getToolStorageKey('normalize-sync-test'),
      }));
      await Promise.resolve();
    });
    expect(container.textContent).toBe('12');

    await act(async () => root.unmount());
  });
});
