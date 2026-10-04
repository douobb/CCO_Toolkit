import {
  defaultSharedUserInputs,
  parseSharedUserInputs,
  sharedUserInputsStorageKey,
  type SharedUserInputs,
} from '../shared-user-inputs';
import {
  clearSharedUserInputs,
  loadSharedUserInputs,
  parseSharedUserInputsStorageRecord,
  saveSharedUserInputs,
} from './shared-user-inputs-storage';
import { getStorage, type StorageLike, type StorageOptions } from './storage';

export interface SharedUserInputsStorageEventTarget {
  addEventListener(
    type: 'storage',
    listener: (event: StorageEvent) => void,
  ): void;
  removeEventListener(
    type: 'storage',
    listener: (event: StorageEvent) => void,
  ): void;
}

export interface SharedUserInputsStoreOptions extends StorageOptions {
  /** 測試或自訂 host 可注入 storage event target；預設使用瀏覽器 window。 */
  readonly eventTarget?: SharedUserInputsStorageEventTarget | null;
  /** React hydration 可延後到 effect 才讀取瀏覽器狀態；預設維持既有 eager 行為。 */
  readonly autoHydrate?: boolean;
}

export type SharedUserInputsUpdater = (
  current: SharedUserInputs,
) => unknown;

export interface SharedUserInputsStore {
  /** 取得目前 immutable snapshot；同一狀態期間維持相同 reference。 */
  readonly getSnapshot: () => SharedUserInputs;
  /** 訂閱同頁更新；回傳函式可解除訂閱。 */
  readonly subscribe: (listener: () => void) => () => void;
  /** 以完整 snapshot 取代目前共用資料，通過 schema 後才會接受。 */
  readonly replace: (value: unknown) => boolean;
  /** 依目前 snapshot 產生並驗證下一個 snapshot。 */
  readonly update: (updater: SharedUserInputsUpdater) => boolean;
  /** replace 的語意別名，方便 framework adapter 使用。 */
  readonly setSnapshot: (value: unknown) => boolean;
  /** 清除持久化資料並回到安全預設值。 */
  readonly clear: () => boolean;
  /** reset 與 clear 等價，保留呼叫端的語意選擇。 */
  readonly reset: () => boolean;
  /** 延遲載入持久化資料並註冊跨分頁事件；重複呼叫不會重複通知或註冊。 */
  readonly hydrate: () => boolean;
  /** 卸除 storage listener 與所有訂閱，避免頁面生命週期造成洩漏。 */
  readonly dispose: () => void;
}

function getBrowserEventTarget(): SharedUserInputsStorageEventTarget | null {
  return typeof window === 'undefined' ? null : window;
}

function getSnapshotSerialization(value: SharedUserInputs): string | undefined {
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

/**
 * 建立與 React 無關的 Shared User Inputs store。
 *
 * 建立時只載入一次持久化 snapshot；同頁更新直接通知 subscribers，跨分頁
 * 則只接受正確 key、正確 storage area 與目前版本的合法 storage event。
 */
export function createSharedUserInputsStore(
  options: SharedUserInputsStoreOptions = {},
): SharedUserInputsStore {
  let storage: StorageLike | null = null;
  let eventTarget: SharedUserInputsStorageEventTarget | null = null;
  const listeners = new Set<() => void>();
  let disposed = false;
  let hydrated = false;
  let listening = false;
  let snapshot = defaultSharedUserInputs;
  let snapshotSerialization = getSnapshotSerialization(snapshot);
  const defaultSnapshotSerialization = snapshotSerialization;

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // 單一 consumer 的例外不應阻止其他 consumer 收到同一更新。
      }
    }
  };

  const applySnapshot = (
    value: unknown,
    persist: boolean,
  ): { accepted: boolean; changed: boolean } => {
    const parsed = parseSharedUserInputs(value);
    if (!parsed) return { accepted: false, changed: false };

    const nextSerialization = getSnapshotSerialization(parsed);
    if (nextSerialization === undefined) return { accepted: false, changed: false };

    const nextSnapshot =
      nextSerialization === defaultSnapshotSerialization
        ? defaultSharedUserInputs
        : parsed;

    const changed = nextSerialization !== snapshotSerialization;
    if (persist) {
      saveSharedUserInputs(parsed, { storage });
    }

    if (!changed) return { accepted: true, changed: false };

    snapshot = nextSnapshot;
    snapshotSerialization = nextSerialization;
    notify();
    return { accepted: true, changed: true };
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (disposed) return;
    if (event.key !== sharedUserInputsStorageKey && event.key !== null) return;
    if (storage && event.storageArea && event.storageArea !== storage) return;

    if (event.key === null || event.newValue === null) {
      applySnapshot(defaultSharedUserInputs, false);
      return;
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(event.newValue) as unknown;
    } catch {
      return;
    }

    const parsed = parseSharedUserInputsStorageRecord(decoded);
    if (parsed.status !== 'valid') return;

    // 外部事件只更新記憶體，不再次 setItem，避免回音與重複跨頁通知。
    applySnapshot(parsed.value, false);
  };

  const hydrate = () => {
    if (disposed || hydrated) return false;
    hydrated = true;
    storage = getStorage(options);
    eventTarget =
      options.eventTarget === undefined
        ? getBrowserEventTarget()
        : options.eventTarget;

    const loaded = loadSharedUserInputs({ storage });
    const changed =
      loaded.status === 'valid'
        ? applySnapshot(loaded.value, false).changed
        : false;

    if (storage && eventTarget) {
      try {
        eventTarget.addEventListener('storage', handleStorageEvent);
        listening = true;
      } catch {
        // host 禁止註冊事件時仍保留同頁 store 與持久化能力。
      }
    }

    return changed;
  };

  if (options.autoHydrate !== false) hydrate();

  const replace = (value: unknown) => {
    if (disposed) return false;
    return applySnapshot(value, true).accepted;
  };

  const update = (updater: SharedUserInputsUpdater) => {
    if (disposed) return false;

    let nextValue: unknown;
    try {
      nextValue = updater(snapshot);
    } catch {
      return false;
    }

    return applySnapshot(nextValue, true).accepted;
  };

  const clear = () => {
    if (disposed) return false;

    const removed = clearSharedUserInputs({ storage });
    const changed = applySnapshot(defaultSharedUserInputs, false).changed;
    return removed || changed;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;

    if (listening && eventTarget) {
      try {
        eventTarget.removeEventListener('storage', handleStorageEvent);
      } catch {
        // dispose 必須維持 idempotent；host 清理失敗時不再重新註冊 listener。
      }
    }

    listeners.clear();
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      if (disposed) return () => undefined;

      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace,
    update,
    setSnapshot: replace,
    clear,
    reset: clear,
    hydrate,
    dispose,
  };
}

export type { StorageLike };
